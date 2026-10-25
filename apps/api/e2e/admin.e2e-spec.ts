import type { INestApplication } from "@nestjs/common";
import type { AdminFunnel, AdminOverview } from "@billsafi/contracts";
import { and, asc, type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import { FREE_PLAN } from "@billsafi/domain";
import request from "supertest";
import { AccountAccessService } from "../src/admin/account-access.service.js";
import { AdminBillingService } from "../src/admin/admin-billing.service.js";
import { AdminMetricsService } from "../src/admin/admin-metrics.service.js";
import { AdminRoleSyncService } from "../src/admin/admin-role-sync.service.js";
import { AuditService } from "../src/audit/audit.service.js";
import { DISABLED_ADMIN_PATHS } from "../src/auth/auth.js";
import type { FakeMpesaProvider } from "../src/billing/mpesa/fake.provider.js";
import { DATABASE } from "../src/database/database.module.js";
import {
  createBusiness,
  createClient,
  createTestApp,
  sessionCookie,
  signUp,
  uniqueEmail,
  WEB_ORIGIN,
} from "./support/app.js";

const CALLBACK = "/api/v1/billing/mpesa/callback/e2e-callback-token-0123456789";
const ROUTES = ["access", "overview", "funnel", "retention", "users", "billing"];

/** IDs from the developer's .env stay listed, so tests never demote a real local admin. */
const ENV_ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);

/**
 * Builds an app whose start-up sync gives exactly these users (plus the .env admins) the
 * admin role and takes it from everyone else, so every app in this file must list the
 * main admin unless a test means to demote them.
 */
async function appWithAdmins(ids: string[]) {
  const previous = process.env.ADMIN_USER_IDS;
  process.env.ADMIN_USER_IDS = [...ENV_ADMIN_IDS, ...ids].join(",");
  try {
    return await createTestApp({ adminRoleSync: true });
  } finally {
    if (previous === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = previous;
  }
}

/** The 15 HTTP endpoints Better Auth 1.7's admin plugin registers; all must be off. */
const PLUGIN_ENDPOINTS = [
  ["post", "/admin/set-role"],
  ["get", "/admin/get-user"],
  ["post", "/admin/create-user"],
  ["post", "/admin/update-user"],
  ["get", "/admin/list-users"],
  ["post", "/admin/list-user-sessions"],
  ["post", "/admin/unban-user"],
  ["post", "/admin/ban-user"],
  ["post", "/admin/impersonate-user"],
  ["post", "/admin/stop-impersonating"],
  ["post", "/admin/revoke-user-session"],
  ["post", "/admin/revoke-user-sessions"],
  ["post", "/admin/remove-user"],
  ["post", "/admin/set-user-password"],
  ["post", "/admin/has-permission"],
] as const;

describe("admin", () => {
  let app: INestApplication;
  let mpesa: FakeMpesaProvider;
  let adminCookie: string;
  let adminId: string;
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
    adminId = session.body.user.id;
    await setup.close();
    ({ app, mpesa } = await appWithAdmins([adminId]));
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

    it("echoes a request ID on every response", async () => {
      const response = await api()
        .get("/api/v1/admin/overview")
        .set("x-request-id", "e2e-trace-1")
        .expect(404);
      expect(response.headers["x-request-id"]).toBe("e2e-trace-1");
      const generated = await api().get("/api/v1/health");
      expect(generated.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe("roles", () => {
    const roleOf = async (id: string) =>
      (await db().select().from(schema.users).where(eq(schema.users.id, id)))[0]!.role;
    const roleAudit = (id: string) =>
      db()
        .select()
        .from(schema.auditLogs)
        .where(
          and(
            eq(schema.auditLogs.targetType, "user"),
            eq(schema.auditLogs.targetId, id),
            eq(schema.auditLogs.action, "user.role_change"),
          ),
        )
        .orderBy(asc(schema.auditLogs.occurredAt));

    it("gives new accounts the user role", async () => {
      const { email } = await signUp(app);
      expect(await roleOf(await userId(email))).toBe("user");
    });

    it("syncs ADMIN_USER_IDS on start, auditing each change, and a demotion applies at once", async () => {
      const listed = await signUp(app, uniqueEmail("promoted"));
      const listedId = await userId(listed.email);
      const stray = await signUp(app, uniqueEmail("stray-admin"));
      const strayId = await userId(stray.email);
      // An admin role nobody listed, as if an ID was removed from the env.
      await db().update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, strayId));
      await api().get("/api/v1/admin/access").set("Cookie", stray.cookie).expect(204);

      // An ID with no user (say, a typo) is logged and skipped; start-up goes on.
      const synced = await appWithAdmins([adminId, listedId, crypto.randomUUID()]);
      await synced.app.close();

      expect(await roleOf(listedId)).toBe("admin");
      expect(await roleOf(strayId)).toBe("user");
      expect(await roleOf(adminId)).toBe("admin");
      // The guard reads the role on every request, so the running app agrees right away.
      await api().get("/api/v1/admin/access").set("Cookie", listed.cookie).expect(204);
      await api().get("/api/v1/admin/access").set("Cookie", stray.cookie).expect(404);

      expect(await roleAudit(listedId)).toEqual([
        expect.objectContaining({
          actorUserId: null,
          actorRole: "system",
          outcome: "success",
          changes: { role: { from: "user", to: "admin" } },
        }),
      ]);
      expect(await roleAudit(strayId)).toEqual([
        expect.objectContaining({
          actorUserId: null,
          actorRole: "system",
          changes: { role: { from: "admin", to: "user" } },
        }),
      ]);

      // Taking the ID off the list and restarting demotes them.
      const relisted = await appWithAdmins([adminId]);
      await relisted.app.close();
      expect(await roleOf(listedId)).toBe("user");
      await api().get("/api/v1/admin/access").set("Cookie", listed.cookie).expect(404);
      expect(await roleAudit(listedId)).toHaveLength(2);
    });

    it("is idempotent: a second start with the same list changes and audits nothing", async () => {
      const before = await db().select({ id: schema.auditLogs.id }).from(schema.auditLogs);
      const again = await appWithAdmins([adminId]);
      const result = await again.app.get(AdminRoleSyncService).sync();
      await again.app.close();
      expect(result).toMatchObject({ promoted: [], demoted: [] });
      const after = await db().select({ id: schema.auditLogs.id }).from(schema.auditLogs);
      expect(after.length).toBe(before.length);
    });
  });

  describe("Better Auth admin plugin", () => {
    it.each(PLUGIN_ENDPOINTS)("switches off %s %s, even for an admin", async (method, path) => {
      const call = api()[method](`/api/v1/auth${path}`);
      const response = await call
        .set("Origin", WEB_ORIGIN)
        .set("Cookie", adminCookie)
        .send({})
        .expect(404);
      // Better Auth's disabledPaths answers plain "Not Found"; an unknown auth route is empty.
      expect(response.text).toBe("Not Found");
    });

    it("answers an unknown auth route differently, so the check above means something", async () => {
      const response = await api()
        .post("/api/v1/auth/admin/not-a-route")
        .set("Origin", WEB_ORIGIN)
        .send({});
      expect(response.status).toBe(404);
      expect(response.text).not.toBe("Not Found");
    });

    it("lists every endpoint the plugin registers", () => {
      expect([...DISABLED_ADMIN_PATHS].sort()).toEqual(
        PLUGIN_ENDPOINTS.map(([, path]) => path).sort(),
      );
    });

    it("never lets a stranger promote themselves", async () => {
      const { cookie, email } = await signUp(app);
      await api()
        .post("/api/v1/auth/admin/set-role")
        .set("Origin", WEB_ORIGIN)
        .set("Cookie", cookie)
        .send({ userId: await userId(email), role: "admin" })
        .expect(404);
      const update = await api()
        .post("/api/v1/auth/update-user")
        .set("Origin", WEB_ORIGIN)
        .set("Cookie", cookie)
        .send({ role: "admin" })
        .expect(400);
      expect(update.body.code).toBe("FIELD_NOT_ALLOWED");
      expect(
        (await db().select().from(schema.users).where(eq(schema.users.email, email)))[0]!.role,
      ).toBe("user");
    });

    it("refuses a role at sign-up", async () => {
      const email = uniqueEmail("signup-admin");
      const response = await api()
        .post("/api/v1/auth/sign-up/email")
        .set("Origin", WEB_ORIGIN)
        .send({ name: "Wanjiku Kamau", email, password: "correct-horse-battery", role: "admin" })
        .expect(400);
      expect(response.body.code).toBe("FIELD_NOT_ALLOWED");
      expect(await db().select().from(schema.users).where(eq(schema.users.email, email))).toEqual(
        [],
      );
    });
  });

  describe("suspension", () => {
    const signIn = (email: string) =>
      api()
        .post("/api/v1/auth/sign-in/email")
        .set("Origin", WEB_ORIGIN)
        .send({ email, password: "correct-horse-battery" });

    it("blocks sign-in and ends existing sessions, until reactivated", async () => {
      const { cookie, email } = await signUp(app, uniqueEmail("suspended"));
      const id = await userId(email);
      await api().get("/api/v1/businesses").set("Cookie", cookie).expect(200);

      await app.get(AccountAccessService).suspend(id, "Chargeback fraud report");

      await api().get("/api/v1/businesses").set("Cookie", cookie).expect(401);
      const refused = await signIn(email).expect(403);
      expect(refused.body.code).toBe("BANNED_USER");
      expect(refused.headers["set-cookie"]?.toString() ?? "").not.toContain(
        "better-auth.session_token=",
      );
      const [user] = await db().select().from(schema.users).where(eq(schema.users.id, id));
      expect(user).toMatchObject({ banned: true, banReason: "Chargeback fraud report" });

      await app.get(AccountAccessService).reactivate(id);
      const back = await signIn(email).expect(200);
      await api()
        .get("/api/v1/businesses")
        .set("Cookie", sessionCookie(back.headers["set-cookie"]))
        .expect(200);
    });

    it("rejects a banned account's surviving session on every route", async () => {
      const { cookie, email } = await signUp(app, uniqueEmail("ban-no-revoke"));
      const id = await userId(email);
      // Promote too, so the admin routes are covered; sessions are deliberately left alone.
      await db()
        .update(schema.users)
        .set({ role: "admin", banned: true })
        .where(eq(schema.users.id, id));
      try {
        await api().get("/api/v1/businesses").set("Cookie", cookie).expect(401);
        await api().get("/api/v1/admin/access").set("Cookie", cookie).expect(404);
        await api().get("/api/v1/admin/overview").set("Cookie", cookie).expect(404);
      } finally {
        // Back to a plain user, so later role-sync assertions see no stray admin.
        await db().update(schema.users).set({ role: "user" }).where(eq(schema.users.id, id));
      }
    });

    it("revokes every session without suspending", async () => {
      const { cookie, email } = await signUp(app, uniqueEmail("revoked"));
      await app.get(AccountAccessService).revokeSessions(await userId(email));
      await api().get("/api/v1/businesses").set("Cookie", cookie).expect(401);
      await signIn(email).expect(200);
    });
  });

  describe("audit log", () => {
    it("stores redacted rows and refuses UPDATE and DELETE", async () => {
      const action = `e2e.audit_check.${crypto.randomUUID()}`;
      const rollback = new Error("roll back the test row");
      // Inside a transaction that is always rolled back, so the shared database keeps no test row.
      await expect(
        db().transaction(async (tx) => {
          await app.get(AuditService).record(
            {
              actor: { userId: adminId, role: "admin" },
              action,
              target: { type: "user", id: adminId },
              outcome: "failure",
              reason: "Checking redaction",
              changes: { phone: "+254712345678", sessionToken: "secret-value", plan: "pro" },
              request: { requestId: "e2e-request", ip: "127.0.0.1" },
            },
            tx,
          );
          const [row] = await tx
            .select()
            .from(schema.auditLogs)
            .where(eq(schema.auditLogs.action, action));
          expect(row).toMatchObject({
            actorUserId: adminId,
            actorRole: "admin",
            outcome: "failure",
            changes: { phone: "+2547•••••678", plan: "pro" },
            requestId: "e2e-request",
            ipAddress: "127.0.0.1",
          });
          throw rollback;
        }),
      ).rejects.toBe(rollback);

      // Any committed row will do; the role sync above has written some.
      const [existing] = await db().select().from(schema.auditLogs).limit(1);
      expect(existing).toBeDefined();
      const failure = (query: Promise<unknown>) =>
        query.then(
          () => new Error("query succeeded"),
          (error: Error & { cause?: Error }) => error.cause ?? error,
        );
      const where = eq(schema.auditLogs.id, existing!.id);
      expect(
        (await failure(db().update(schema.auditLogs).set({ reason: "rewritten" }).where(where)))
          .message,
      ).toMatch(/append-only: UPDATE/);
      expect((await failure(db().delete(schema.auditLogs).where(where))).message).toMatch(
        /append-only: DELETE/,
      );
      expect((await failure(db().execute(sql`truncate audit_logs`))).message).toMatch(
        /append-only: TRUNCATE/,
      );
      const [still] = await db()
        .select()
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.id, existing!.id));
      expect(still).toEqual(existing);
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
