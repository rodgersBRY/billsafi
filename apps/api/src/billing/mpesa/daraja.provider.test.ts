import { describe, expect, it, vi } from "vitest";
import { DarajaMpesaProvider, darajaTimestamp } from "./daraja.provider.js";

const config = {
  environment: "sandbox" as const,
  consumerKey: "key",
  consumerSecret: "secret",
  shortcode: "174379",
  passkey: "passkey",
  callbackUrl: "https://example.test/api/v1/billing/mpesa/callback/token",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeFetch(...responses: Response[]) {
  const token = json(200, { access_token: "token-1", expires_in: "3599" });
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(token)
    .mockImplementation(async () => responses.shift()!);
}

describe("darajaTimestamp", () => {
  it("formats Nairobi local time", () => {
    expect(darajaTimestamp(new Date("2026-10-17T07:05:09Z"))).toBe("20261017100509");
  });
});

describe("DarajaMpesaProvider", () => {
  it("signs a Paybill STK Push with the shortcode, passkey and timestamp", async () => {
    const fetchImpl = fakeFetch(
      json(200, { MerchantRequestID: "m-1", CheckoutRequestID: "ws_CO_1", ResponseCode: "0" }),
    );
    const provider = new DarajaMpesaProvider(config, fetchImpl);
    const accepted = await provider.stkPush({
      amount: 500,
      phone: "254708374149",
      accountReference: "BillSafi",
      description: "Pro month",
    });

    expect(accepted).toEqual({ merchantRequestId: "m-1", checkoutRequestId: "ws_CO_1" });
    const [tokenUrl, tokenInit] = fetchImpl.mock.calls[0]!;
    expect(tokenUrl).toBe(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    );
    expect((tokenInit!.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("key:secret").toString("base64")}`,
    );
    const [url, init] = fetchImpl.mock.calls[1]!;
    expect(url).toBe("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest");
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({
      BusinessShortCode: "174379",
      TransactionType: "CustomerPayBillOnline",
      Amount: 500,
      PartyA: "254708374149",
      PartyB: "174379",
      CallBackURL: config.callbackUrl,
    });
    expect(Buffer.from(body.Password, "base64").toString()).toBe(`174379passkey${body.Timestamp}`);
  });

  it("reuses the access token until it nears expiry", async () => {
    const fetchImpl = fakeFetch(json(200, { ResultCode: "0" }), json(200, { ResultCode: "0" }));
    const provider = new DarajaMpesaProvider(config, fetchImpl);
    await provider.query("ws_CO_1");
    await provider.query("ws_CO_1");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("maps query results", async () => {
    const provider = new DarajaMpesaProvider(
      config,
      fakeFetch(
        json(500, {
          errorCode: "500.001.1001",
          errorMessage: "The transaction is being processed",
        }),
        json(200, {
          ResponseCode: "0",
          ResultCode: "1032",
          ResultDesc: "Request cancelled by user",
        }),
        json(200, { ResponseCode: "0", ResultCode: "0", ResultDesc: "Processed" }),
      ),
    );
    expect(await provider.query("a")).toEqual({ state: "pending" });
    expect(await provider.query("b")).toEqual({
      state: "failed",
      resultCode: "1032",
      resultDescription: "Request cancelled by user",
    });
    expect(await provider.query("c")).toEqual({ state: "succeeded" });
  });

  it("reports a rejected STK Push", async () => {
    const provider = new DarajaMpesaProvider(
      config,
      fakeFetch(
        json(400, { errorCode: "400.002.02", errorMessage: "Bad Request - Invalid PhoneNumber" }),
      ),
    );
    await expect(
      provider.stkPush({
        amount: 500,
        phone: "1",
        accountReference: "BillSafi",
        description: "Pro",
      }),
    ).rejects.toThrow("Bad Request - Invalid PhoneNumber");
  });
});
