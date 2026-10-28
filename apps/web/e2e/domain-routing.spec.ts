import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";

test.describe("domain routing", () => {
  const originalApp = process.env.APP_ORIGIN;
  const originalMarketing = process.env.MARKETING_ORIGIN;
  test.beforeEach(() => {
    process.env.APP_ORIGIN = "https://account.billsafi.com";
    process.env.MARKETING_ORIGIN = "https://billsafi.com";
  });
  test.afterEach(() => {
    if (originalApp === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = originalApp;
    if (originalMarketing === undefined) delete process.env.MARKETING_ORIGIN;
    else process.env.MARKETING_ORIGIN = originalMarketing;
  });

  async function route(host: string, path = "/", signedIn = false) {
    return proxy(
      new NextRequest(`https://${host}${path}`, {
        headers: { host, ...(signedIn ? { cookie: "better-auth.session_token=test" } : {}) },
      }),
    );
  }

  test("marketing root always renders landing, including with a session cookie", async () => {
    for (const signedIn of [false, true]) {
      const response = await route("billsafi.com", "/?source=campaign", signedIn);
      expect(response.headers.get("x-middleware-rewrite")).toBe(
        "https://billsafi.com/landing?source=campaign",
      );
    }
  });

  test("app root uses authentication and signed-in business routing", async () => {
    expect((await route("account.billsafi.com")).headers.get("location")).toBe(
      "https://account.billsafi.com/sign-in",
    );
    expect((await route("account.billsafi.com", "/", true)).headers.get("x-middleware-next")).toBe(
      "1",
    );
  });

  test("generator, auth, invoices and old app links move to the account origin", async () => {
    for (const path of [
      "/sign-in",
      "/sign-up",
      "/free-invoice-generator",
      "/free-invoice-generator/finish",
      "/i/shared-token",
      "/business/overview",
    ]) {
      expect((await route("billsafi.com", `${path}?source=old`)).headers.get("location")).toBe(
        `https://account.billsafi.com${path}?source=old`,
      );
    }
    expect(
      (await route("account.billsafi.com", "/free-invoice-generator")).headers.get(
        "x-middleware-next",
      ),
    ).toBe("1");
    expect(
      (await route("account.billsafi.com", "/i/shared-token")).headers.get("x-middleware-next"),
    ).toBe("1");
  });

  test("legal pages and landing aliases have a canonical marketing host", async () => {
    for (const path of ["/terms", "/privacy"]) {
      expect((await route("billsafi.com", path)).headers.get("x-middleware-next")).toBe("1");
      expect((await route("account.billsafi.com", path)).headers.get("location")).toBe(
        `https://billsafi.com${path}`,
      );
    }
    for (const host of ["billsafi.com", "account.billsafi.com"]) {
      expect((await route(host, "/landing")).headers.get("location")).toBe("https://billsafi.com/");
    }
  });

  test("local single-origin mode retains the landing and generator", async () => {
    delete process.env.APP_ORIGIN;
    delete process.env.MARKETING_ORIGIN;
    expect((await route("localhost:3000")).headers.get("x-middleware-rewrite")).toBe(
      "https://localhost:3000/landing",
    );
    expect(
      (await route("localhost:3000", "/free-invoice-generator")).headers.get("x-middleware-next"),
    ).toBe("1");
  });
});
