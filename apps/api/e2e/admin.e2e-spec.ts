import type { INestApplication } from "@nestjs/common";
import { FREE_PLAN } from "@billsafi/domain";
import request from "supertest";
import type { FakeMpesaProvider } from "../src/billing/mpesa/fake.provider.js";
import { createBusiness, createClient, createTestApp, signUp, uniqueEmail } from "./support/app.js";

const CALLBACK = "/api/v1/billing/mpesa/callback/e2e-callback-token-0123456789";
const ROUTES = ["overview", "funnel", "retention", "users", "billing"];

/** Builds an app whose admin list is fixed at start-up, so it must be set first. */
async function appWithAdmins(ids: string) {
  const previous = process.env.ADMIN_USER_IDS;
  process.env.ADMIN_USER_IDS = ids;
  try {
    return await createTestApp();
  } finally {
    if (previous === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = previous;
  }
}

describe("admin", () => {
  let app: INestApplication;
  let mpesa: FakeMpesaProvider;
  let adminCookie: string;
  let customerEmail: string;
  let limitedEmail: string;
  let receipt: string;
  const api = () => request(app.getHttpServer());
  const admin = (path: string) => api().get(`/api/v1/admin/${path}`).set("Cookie", adminCookie);

  /** Signs up an account with one business and client, then makes `ready` invoices Ready. */
  async function seedAccount(label: string, ready: number) {
    const { cookie, email } = await signUp(app, uniqueEmail(label));
    const businessId = await createBusiness(app, cookie, { displayName: "Seeded Studio" });
    const clientId = await createClient(app, cookie, businessId);
    const path = `/api/v1/businesses/${businessId}/invoices`;
    for (let index = 0; index < ready; index++) {
      const draft = await api()
        .post(path)
        .set("Cookie", cookie)
        .send({
          clientId,
          issueDate: "2026-10-16",
          dueDate: "2026-10-30",
          items: [{ description: "Design work", quantity: "1", unitPrice: "1000" }],
        })
        .expect(201);
      await api().post(`${path}/${draft.body.id}/ready`).set("Cookie", cookie).expect(200);
    }
    return { cookie, email };
  }

  /** A customer with a business, a client, a Ready invoice and a paid Pro month. */
  async function seedCustomer() {
    const { cookie, email } = await seedAccount("admin-seed", 1);

    await api()
      .post("/api/v1/billing/checkout")
      .set("Cookie", cookie)
      .send({ purpose: "pro_month", phone: "0708 374 149" })
      .expect(201);
    receipt = `TK${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    await api()
      .post(CALLBACK)
      .send({
        Body: {
          stkCallback: {
            MerchantRequestID: "29115-34620561-1",
            CheckoutRequestID: mpesa.last()!.checkoutRequestId,
            ResultCode: 0,
            ResultDesc: "The service request is processed successfully.",
            CallbackMetadata: {
              Item: [
                { Name: "Amount", Value: 500 },
                { Name: "MpesaReceiptNumber", Value: receipt },
                { Name: "TransactionDate", Value: 20261017102115 },
                { Name: "PhoneNumber", Value: 254708374149 },
              ],
            },
          },
        },
      })
      .expect(200);
    return email;
  }

  beforeAll(async () => {
    // A user's ID is only known after sign-up, so make the admin first.
    const setup = (await createTestApp()).app;
    const { cookie } = await signUp(setup);
    adminCookie = cookie;
    const session = await request(setup.getHttpServer())
      .get("/api/v1/auth/get-session")
      .set("Cookie", cookie)
      .expect(200);
    const adminId: string = session.body.user.id;
    await setup.close();
    ({ app, mpesa } = await appWithAdmins(adminId));
    // Seed before any admin request so the 60-second cache cannot hide it.
    customerEmail = await seedCustomer();
    // A Free account that uses its whole monthly allowance and does not pay.
    limitedEmail = (await seedAccount("admin-limit", FREE_PLAN.invoiceLimit)).email;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("access", () => {
    it.each(ROUTES)("answers 404 on %s to a signed-out visitor", async (route) => {
      await api().get(`/api/v1/admin/${route}`).expect(404);
    });

    it.each(ROUTES)("answers 404 on %s to a signed-in user who is not an admin", async (route) => {
      const { cookie } = await signUp(app);
      await api().get(`/api/v1/admin/${route}`).set("Cookie", cookie).expect(404);
    });

    it("looks the same as an unknown route", async () => {
      const unknown = await api().get("/api/v1/admin/nothing");
      const guarded = await api().get("/api/v1/admin/overview");
      expect(Object.keys(guarded.body).sort()).toEqual(Object.keys(unknown.body).sort());
      expect(guarded.body.error).toBe(unknown.body.error);
    });

    it("lets a listed admin in", async () => {
      await admin("overview").expect(200);
    });

    it("turns admin off for everyone when the list is empty", async () => {
      const closed = (await appWithAdmins("")).app;
      try {
        await request(closed.getHttpServer())
          .get("/api/v1/admin/overview")
          .set("Cookie", adminCookie)
          .expect(404);
      } finally {
        await closed.close();
      }
    });
  });

  describe("data", () => {
    // The e2e database is shared with other spec files, so global counts are lower bounds.
    it("counts the seeded account as paying in the overview", async () => {
      const { body } = await admin("overview").expect(200);
      expect(body.payingAccounts).toBeGreaterThanOrEqual(1);
      expect(body.mrrUsd).toBe((body.payingAccounts * 4).toFixed(2));
      expect(body.totalAccounts).toBeGreaterThanOrEqual(2);
      expect(body.signups.today.total).toBeGreaterThanOrEqual(2);
      expect(body.signups.today.total).toBe(body.signups.today.google + body.signups.today.email);
      expect(body.activeBusinesses).toBeGreaterThanOrEqual(1);
      expect(body.invoicesReadyThisMonth).toBeGreaterThanOrEqual(1);
      expect(Number(body.kesCollectedThisMonth)).toBeGreaterThanOrEqual(500);
      expect(body.conversion).toBeGreaterThan(0);
      expect(body.mpesaSuccessRate30Days).toBeGreaterThan(0);
    });

    it("shows every funnel step for recent signups", async () => {
      const { body } = await admin("funnel?days=7").expect(200);
      expect(body.days).toBe(7);
      expect(body.steps.map((step: { key: string }) => step.key)).toEqual([
        "signed_up",
        "business_created",
        "client_added",
        "invoice_created",
        "invoice_ready",
        "payment_recorded",
      ]);
      const [signedUp, business, , , ready] = body.steps;
      expect(signedUp.users).toBeGreaterThanOrEqual(2);
      expect(signedUp.shareOfSignups).toBe(1);
      expect(business.users).toBeGreaterThanOrEqual(1);
      expect(ready.users).toBeGreaterThanOrEqual(1);
      expect(ready.medianSecondsFromSignup).toBeGreaterThanOrEqual(0);
    });

    it("builds weekly retention cohorts ending with this week", async () => {
      const { body } = await admin("retention?weeks=4").expect(200);
      expect(body.cohorts).toHaveLength(4);
      const thisWeek = body.cohorts.at(-1);
      expect(thisWeek.users).toBeGreaterThanOrEqual(2);
      expect(thisWeek.activeShare).toHaveLength(1);
      expect(thisWeek.activeShare[0]).toBeGreaterThan(0);
      expect(body.cohorts[0].activeShare).toHaveLength(4);
    });

    it("finds the seeded user by part of their email and shows their details", async () => {
      const part = customerEmail.slice(0, 30).toUpperCase();
      const list = await admin(`users?search=${encodeURIComponent(part)}`).expect(200);
      expect(list.body.total).toBe(1);
      const [row] = list.body.users;
      expect(row).toMatchObject({
        email: customerEmail,
        signInMethod: "email",
        plan: { code: "pro" },
        businesses: 1,
        invoicesReady: 1,
      });
      expect(row.lastActiveAt).not.toBeNull();

      const detail = await admin(`users/${row.id}`).expect(200);
      expect(detail.body.user.id).toBe(row.id);
      expect(detail.body.businesses).toEqual([
        expect.objectContaining({
          name: "Seeded Studio",
          clients: 1,
          invoices: { draft: 0, ready: 1, partially_paid: 0, paid: 0, cancelled: 0 },
        }),
      ]);
      expect(detail.body.payments).toEqual([
        expect.objectContaining({
          purpose: "pro_month",
          amountKes: "500.00",
          status: "succeeded",
          receipt,
        }),
      ]);
    });

    it("lists the seeded payment in billing with the phone masked", async () => {
      const { body } = await admin("billing").expect(200);
      const payment = body.recentPayments.find(
        (row: { receipt: string | null }) => row.receipt === receipt,
      );
      expect(payment).toMatchObject({
        userEmail: customerEmail,
        purpose: "pro_month",
        amountKes: "500.00",
        priceUsd: "4.00",
        status: "succeeded",
        phone: "+2547•••••149",
        resultDescription: null,
      });
      expect(Array.isArray(body.stuckPayments)).toBe(true);
    });

    it("lists a Free account that reached its monthly limit", async () => {
      const { body } = await admin("billing").expect(200);
      const hit = body.freeLimitHits.find(
        (row: { userEmail: string }) => row.userEmail === limitedEmail,
      );
      expect(hit).toMatchObject({ limit: FREE_PLAN.invoiceLimit, paidWithin30Days: false });
      expect(hit.month).toMatch(/^\d{4}-\d{2}$/);
      expect(
        body.freeLimitHits.some((row: { userEmail: string }) => row.userEmail === customerEmail),
      ).toBe(false);
    });

    it("pages users 25 at a time, newest first", async () => {
      const { body } = await admin("users?page=1").expect(200);
      expect(body.pageSize).toBe(25);
      expect(body.users.length).toBeLessThanOrEqual(25);
      const dates = body.users.map((user: { signedUpAt: string }) => user.signedUpAt);
      expect([...dates].sort().reverse()).toEqual(dates);
    });

    it("rejects an unsupported window with 400", async () => {
      await admin("funnel?days=5").expect(400);
      await admin("retention?weeks=6").expect(400);
      await admin("users?page=0").expect(400);
    });

    it("answers 404 for an unknown or malformed user id", async () => {
      await admin(`users/${crypto.randomUUID()}`).expect(404);
      await admin("users/not-a-uuid").expect(404);
    });
  });
});
