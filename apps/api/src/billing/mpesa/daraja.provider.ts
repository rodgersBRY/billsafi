import {
  MpesaRequestError,
  type MpesaProvider,
  type StkPushAccepted,
  type StkPushRequest,
  type StkQueryResult,
} from "./mpesa.provider.js";

const BASE_URLS = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
} as const;

/** Daraja answers a query for a prompt the customer has not acted on yet with this code. */
const STILL_PROCESSING = "500.001.1001";

export interface DarajaConfig {
  environment: keyof typeof BASE_URLS;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
}

/** Nairobi local time as YYYYMMDDHHmmss, the format Daraja signs requests with. */
export function darajaTimestamp(at: Date): string {
  return new Date(at.getTime() + 3 * 60 * 60 * 1000)
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14);
}

/** Safaricom Daraja M-Pesa Express against a Paybill, sandbox or production. */
export class DarajaMpesaProvider implements MpesaProvider {
  readonly name = "daraja";
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: DarajaConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async stkPush(request: StkPushRequest): Promise<StkPushAccepted> {
    const body = await this.post("/mpesa/stkpush/v1/processrequest", {
      ...this.credentials(),
      TransactionType: "CustomerPayBillOnline",
      Amount: request.amount,
      PartyA: request.phone,
      PartyB: this.config.shortcode,
      PhoneNumber: request.phone,
      CallBackURL: this.config.callbackUrl,
      // Daraja caps these at 12 and 13 characters.
      AccountReference: request.accountReference.slice(0, 12),
      TransactionDesc: request.description.slice(0, 13),
    });
    if (!body.ok || body.data.ResponseCode !== "0") {
      throw new MpesaRequestError(describe(body.data, "M-Pesa did not accept the payment request"));
    }
    return {
      merchantRequestId: String(body.data.MerchantRequestID),
      checkoutRequestId: String(body.data.CheckoutRequestID),
    };
  }

  async query(checkoutRequestId: string): Promise<StkQueryResult> {
    const body = await this.post("/mpesa/stkpushquery/v1/query", {
      ...this.credentials(),
      CheckoutRequestID: checkoutRequestId,
    });
    if (!body.ok) {
      if (body.data.errorCode === STILL_PROCESSING) return { state: "pending" };
      throw new MpesaRequestError(describe(body.data, "Could not check the payment status"));
    }
    const resultCode = String(body.data.ResultCode ?? "");
    if (resultCode === "") return { state: "pending" };
    if (resultCode === "0") return { state: "succeeded" };
    return {
      state: "failed",
      resultCode,
      resultDescription: String(body.data.ResultDesc ?? "Payment was not completed"),
    };
  }

  private credentials() {
    const timestamp = darajaTimestamp(new Date());
    return {
      BusinessShortCode: this.config.shortcode,
      Password: Buffer.from(this.config.shortcode + this.config.passkey + timestamp).toString(
        "base64",
      ),
      Timestamp: timestamp,
    };
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    const basic = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString(
      "base64",
    );
    const response = await this.fetchImpl(
      `${BASE_URLS[this.config.environment]}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${basic}` } },
    );
    if (!response.ok) throw new MpesaRequestError("Could not authenticate with M-Pesa");
    const data = (await response.json()) as { access_token: string; expires_in: string | number };
    // Refresh a minute early so a request never carries an expiring token.
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000,
    };
    return this.token.value;
  }

  private async post(path: string, payload: Record<string, unknown>) {
    const response = await this.fetchImpl(`${BASE_URLS[this.config.environment]}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: response.ok, data };
  }
}

function describe(data: Record<string, unknown>, fallback: string): string {
  const message = data.errorMessage ?? data.ResponseDescription ?? data.CustomerMessage;
  return typeof message === "string" && message ? message : fallback;
}
