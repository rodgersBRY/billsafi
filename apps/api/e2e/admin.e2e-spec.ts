import type { INestApplication } from "@nestjs/common";
import type { AdminFunnel, AdminOverview } from "@billsafi/contracts";
import { type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import { FREE_PLAN } from "@billsafi/domain";
import request from "supertest";
import { AdminBillingService } from "../src/admin/admin-billing.service.js";
import { AdminMetricsService } from "../src/admin/admin-metrics.service.js";
import type { FakeMpesaProvider } from "../src/billing/mpesa/fake.provider.js";
import { DATABASE } from "../src/database/database.module.js";
import { createBusiness, createClient, createTestApp, signUp, uniqueEmail } from "./support/app.js";

const CALLBACK = "/api/v1/billing/mpesa/callback/e2e-callback-token-0123456789";
const ROUTES = ["access", "overview", "funnel", "retention", "users", "billing"];

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
  const db = () => app.get<DatabaseConnection>(DATABASE).db;

  async function userId(email: string): Promise<string> {
    const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email));
    return user!.id;
  }

  /** Signs up an account with one business and client, then makes `ready` invoices Ready. */
  async function seedAccount(label: string, ready: number) {
    const { cookie, email } = await signUp(app, uniqueEmail(label));
    const businessId = await createBusiness(app, cookie, { displayName: "Seeded Studio" });
    const clientId = await createClient(app, cookie, businessId);
    const path = `/api/v1/businesses/${businessId}/invoices`;
    const issue = async (count: number) => {
      for (let index = 0; index < count; index++) {
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
    };
    await issue(ready);
    return { cookie, email, issue };
  }

  /** Pays one Pro month through the fake M-Pesa callback and returns the receipt. */
  async function payPro(cookie: string): Promise<string> {
    await api()
      .post("/api/v1/billing/checkout")
      .set("Cookie", cookie)
      .send({ purpose: "pro_month", phone: "0708 374 149" })
      .expect(201);
    const code = `TK${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
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
                { Name: "MpesaReceiptNumber", Value: code },
                { Name: "TransactionDate", Value: 20261017102115 },
                { Name: "PhoneNumber", Value: 254708374149 },
              ],
            },
          },
        },
      })
      .expect(200);
    return code;
  }

  /** A customer with a business, a client, a Ready invoice and a paid Pro month. */
  async function seedCustomer() {
    const { cookie, email } = await seedAccount("admin-seed", 1);
    receipt = await payPro(cookie);
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

    it("answers 204 on access to a listed admin", async () => {
      await admin("access").expect(204);
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
  /*
   * Exact numbers through the services with a fixed `now`. Other e2e files
   * write to the same database at the same time, so the seeded rows are moved
   * into a window nothing else writes to and the test compares before/after.
   */
  describe("exact numbers", () => {
    const metrics = () => app.get(AdminMetricsService);
    const billing = () => app.get(AdminBillingService);
    /** Moves a Better Auth `timestamp` column, which stores UTC. */
    const setSignup = (id: string, utc: string) =>
      db().execute(sql`update users set created_at = ${utc}::timestamp where id = ${id}`);

    it("adds exactly what was seeded to the overview and funnel", async () => {
      // Tuesday 15 June 2021, 12:00 in Nairobi.
      const now = new Date("2021-06-15T09:00:00Z");
      const before = await metrics().overview(now);
      const funnelBefore = await metrics().funnel(7, now);

      const paying = await seedAccount("admin-exact", 2);
      await payPro(paying.cookie);
      const payingId = await userId(paying.email);
      const { email: googleEmail } = await signUp(app, uniqueEmail("admin-exact-google"));
      const googleId = await userId(googleEmail);
      await db()
        .insert(schema.accounts)
        .values({
          accountId: `google-${googleId}`,
          providerId: "google",
          userId: googleId,
          updatedAt: new Date(),
        });

      // Move both accounts' history to the morning of `now`.
      const t = (time: string) => `2021-06-15T${time}:00Z`;
      await setSignup(payingId, "2021-06-15 05:00:00");
      await setSignup(googleId, "2021-06-15 05:05:00");
      await db().execute(sql`
        update businesses set created_at = ${t("05:10")}::timestamptz where owner_user_id = ${payingId}`);
      await db().execute(sql`
        update clients set created_at = ${t("05:20")}::timestamptz
        where business_id in (select id from businesses where owner_user_id = ${payingId})`);
      await db().execute(sql`
        update invoices set created_at = ${t("05:30")}::timestamptz
        where business_id in (select id from businesses where owner_user_id = ${payingId})`);
      await db().execute(sql`
        update invoice_issuances set issued_at = ${t("05:40")}::timestamptz where user_id = ${payingId}`);
      await db().execute(sql`
        update subscription_payments
        set created_at = ${t("05:50")}::timestamptz, confirmed_at = ${t("05:51")}::timestamptz
        where user_id = ${payingId}`);
      await db().execute(sql`
        update subscriptions set anchor_at = ${t("05:51")}::timestamptz where user_id = ${payingId}`);

      const after = await metrics().overview(now);
      const signups = { total: 2, google: 1, email: 1 };
      const delta = (a: AdminOverview["signups"]["today"], b: typeof a) => ({
        total: a.total - b.total,
        google: a.google - b.google,
        email: a.email - b.email,
      });
      expect(delta(after.signups.today, before.signups.today)).toEqual(signups);
      expect(delta(after.signups.last7Days, before.signups.last7Days)).toEqual(signups);
      expect(delta(after.signups.last30Days, before.signups.last30Days)).toEqual(signups);
      expect(after.payingAccounts - before.payingAccounts).toBe(1);
      expect(Number(after.mrrUsd) - Number(before.mrrUsd)).toBeCloseTo(4, 2);
      expect(after.activeBusinesses - before.activeBusinesses).toBe(1);
      expect(after.invoicesCreatedThisMonth - before.invoicesCreatedThisMonth).toBe(2);
      expect(after.invoicesReadyThisMonth - before.invoicesReadyThisMonth).toBe(2);
      expect(Number(after.kesCollectedThisMonth) - Number(before.kesCollectedThisMonth)).toBe(500);

      const funnelAfter = await metrics().funnel(7, now);
      const stepDelta = (a: AdminFunnel, b: AdminFunnel) =>
        Object.fromEntries(
          a.steps.map((step, index) => [step.key, step.users - b.steps[index]!.users]),
        );
      expect(stepDelta(funnelAfter, funnelBefore)).toEqual({
        signed_up: 2,
        business_created: 1,
        client_added: 1,
        invoice_created: 1,
        invoice_ready: 1,
        payment_recorded: 0,
      });
    });

    it("dates signups by the Nairobi day and Monday week", async () => {
      // 12:00 on Saturday 24 October 2026 in Nairobi; that week began Monday 19 October.
      const now = new Date("2026-10-24T09:00:00Z");
      const ids = await Promise.all(
        ["today", "yesterday", "last-week"].map(async (label) =>
          userId((await signUp(app, uniqueEmail(`admin-edge-${label}`))).email),
        ),
      );
      const overviewBefore = await metrics().overview(now);
      const retentionBefore = await metrics().retention(4, now);

      // 00:30 Saturday, 23:59:59 Friday, and 23:59:59 on the Sunday before, in Nairobi.
      await setSignup(ids[0]!, "2026-10-23 21:30:00");
      await setSignup(ids[1]!, "2026-10-23 20:59:59");
      await setSignup(ids[2]!, "2026-10-18 20:59:59");

      const overviewAfter = await metrics().overview(now);
      expect(overviewAfter.signups.today.total - overviewBefore.signups.today.total).toBe(1);
      expect(overviewAfter.signups.last7Days.total - overviewBefore.signups.last7Days.total).toBe(
        3,
      );

      const retentionAfter = await metrics().retention(4, now);
      const sizes = (retention: typeof retentionAfter) =>
        Object.fromEntries(retention.cohorts.map((cohort) => [cohort.weekStart, cohort.users]));
      const [beforeSizes, afterSizes] = [sizes(retentionBefore), sizes(retentionAfter)];
      expect(afterSizes["2026-10-19"]! - beforeSizes["2026-10-19"]!).toBe(2);
      expect(afterSizes["2026-10-12"]! - beforeSizes["2026-10-12"]!).toBe(1);
    });

    it("does not report a limit hit for an account that upgraded before reaching it", async () => {
      const account = await seedAccount("admin-upgraded", 3);
      await payPro(account.cookie);
      // Seven more this month bring the month to the Free limit, but on Pro.
      await account.issue(FREE_PLAN.invoiceLimit - 3);
      const id = await userId(account.email);

      const { freeLimitHits } = await billing().billing();
      expect(freeLimitHits.some((hit) => hit.userId === id)).toBe(false);
      // The plain Free account seeded earlier is still reported.
      expect(freeLimitHits.some((hit) => hit.userEmail === limitedEmail)).toBe(true);
    });
  });
});
