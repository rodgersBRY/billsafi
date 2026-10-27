import type { INestApplication } from "@nestjs/common";
import type { AdminFunnel, AdminOverview } from "@billsafi/contracts";
import { and, asc, type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import { addNairobiMonths, FREE_PLAN, lifecycleStage, subscriptionStatus } from "@billsafi/domain";
import request from "supertest";
import { AccountAccessService } from "../src/admin/tenants/account-access.service.js";
import { AdminBillingService } from "../src/admin/subscriptions/admin-billing.service.js";
import { AdminMetricsService } from "../src/admin/metrics/admin-metrics.service.js";
import { AdminRoleSyncService } from "../src/admin/access/admin-role-sync.service.js";
import { AdminTenantsService } from "../src/admin/tenants/admin-tenants.service.js";
import { proEndsAtSql } from "../src/admin/shared/account-sql.js";
import { AuditService } from "../src/audit/audit.service.js";
import { DISABLED_ADMIN_PATHS } from "../src/auth/auth.js";
import type { FakeMpesaProvider } from "../src/billing/mpesa/fake.provider.js";
import { DATABASE } from "../src/database/database.module.js";
import { subscriptionSuite } from "./admin-subscriptions.suite.js";
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
const ROUTES = [
  "access",
  "overview",
  "funnel",
  "retention",
  "tenants",
  `tenants/${crypto.randomUUID()}`,
  "users",
  `users/${crypto.randomUUID()}`,
  "billing",
  "audit-logs",
];
const DAY_MS = 24 * 60 * 60 * 1000;
// A 1x1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/** IDs from the developer's .env stay listed, so tests never demote a real local admin. */
const ENV_ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);

/**
 * Builds an app whose start-up sync gives exactly these users (plus the .env admins) the
 * admin role and takes it from everyone else, so every app in this file must list the
 * main admin unless a test means to demote them.
 */
async function appWithAdmins(ids: string[], options: { adminActionLimit?: number } = {}) {
  const previous = process.env.ADMIN_USER_IDS;
  process.env.ADMIN_USER_IDS = [...ENV_ADMIN_IDS, ...ids].join(",");
  try {
    return await createTestApp({ adminRoleSync: true, ...options });
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
  let adminEmail: string;
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
  async function seedAccount(label: string, ready: number, displayName = "Seeded Studio") {
    const { cookie, email } = await signUp(app, uniqueEmail(label));
    const businessId = await createBusiness(app, cookie, { displayName });
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
    return { cookie, email, businessId, issue };
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
    const { cookie, email } = await signUp(setup);
    adminCookie = cookie;
    adminEmail = email;
    const session = await request(setup.getHttpServer())
      .get("/api/v1/auth/get-session")
      .set("Cookie", cookie)
      .expect(200);
    adminId = session.body.user.id;
    await setup.close();
    // A high action limit so this file's many admin actions are not throttled; the
    // limit itself is tested on an app of its own.
    ({ app, mpesa } = await appWithAdmins([adminId], { adminActionLimit: 1000 }));
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

    it("finds the seeded user by part of their email and shows their tenant", async () => {
      const part = customerEmail.slice(0, 30).toUpperCase();
      const list = await admin(`users?search=${encodeURIComponent(part)}`).expect(200);
      expect(list.body.total).toBe(1);
      const [row] = list.body.users;
      expect(row).toMatchObject({
        email: customerEmail,
        signInMethods: ["email"],
        role: "user",
        accountStatus: "active",
        tenantId: row.id,
      });
      expect(row.lastLoginAt).not.toBeNull();

      const tenant = await admin(`tenants/${row.tenantId}`).expect(200);
      expect(tenant.body.tenant).toMatchObject({
        owner: { email: customerEmail },
        plan: { code: "pro", label: "Pro" },
        readyInvoices: 1,
      });
      expect(tenant.body.businesses).toEqual([
        expect.objectContaining({
          displayName: "Seeded Studio",
          clients: 1,
          invoices: { draft: 0, ready: 1, partially_paid: 0, paid: 0, cancelled: 0 },
        }),
      ]);
      expect(tenant.body.subscription.payments).toEqual([
        expect.objectContaining({
          purpose: "pro_month",
          amount: "500.00",
          currency: "KES",
          status: "succeeded",
          receipt,
          phone: "+2547•••••149",
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
        amount: "500.00",
        currency: "KES",
        provider: "mpesa",
        method: null,
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
      const dates = body.users.map((user: { registeredAt: string }) => user.registeredAt);
      expect([...dates].sort().reverse()).toEqual(dates);
    });

    it("rejects an unsupported window with 400", async () => {
      await admin("funnel?days=5").expect(400);
      await admin("retention?weeks=6").expect(400);
      await admin("users?page=0").expect(400);
      await admin("tenants?lifecycle=churned").expect(400);
      await admin("tenants?activeWithin=7&inactiveFor=30").expect(400);
      await admin("audit-logs?from=yesterday").expect(400);
    });

    it("answers 404 for an unknown or malformed user id", async () => {
      await admin(`users/${crypto.randomUUID()}`).expect(404);
      await admin("users/not-a-uuid").expect(404);
      await admin(`tenants/${crypto.randomUUID()}`).expect(404);
      await admin("tenants/not-a-uuid").expect(404);
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
        update subscriptions
        set anchor_at = ${t("05:51")}::timestamptz,
          paid_until = ${addNairobiMonths(new Date(t("05:51")), 1).toISOString()}::timestamptz
        where user_id = ${payingId}`);

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

  /** Moves a Better Auth `timestamp` column, which stores UTC, to an instant. */
  const setRegistered = (id: string, instant: Date) =>
    db().execute(
      sql`update users set created_at = (${instant.toISOString()}::timestamptz at time zone 'UTC') where id = ${id}`,
    );
  const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);
  const setSubscription = (id: string, anchorAt: Date, paidMonths: number) => {
    // Billing always writes paid_until with the anchor and months; tests must too.
    const paidUntil = addNairobiMonths(anchorAt, paidMonths);
    return db()
      .insert(schema.subscriptions)
      .values({ userId: id, anchorAt, paidMonths, paidUntil })
      .onConflictDoUpdate({
        target: schema.subscriptions.userId,
        set: { anchorAt, paidMonths, paidUntil },
      });
  };
  const act = (
    path: string,
    body: object = { reason: "Checked with the owner" },
    cookie = adminCookie,
  ) => api().post(`/api/v1/admin/${path}`).set("Cookie", cookie).send(body);
  const auditFor = (targetId: string) =>
    db()
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.targetId, targetId))
      .orderBy(asc(schema.auditLogs.occurredAt));

  describe("tenants directory", () => {
    const tag = `tn${crypto.randomUUID().slice(0, 8)}`;
    const labels = [
      "registered",
      "onboarding",
      "activated",
      "subscribed",
      "ending",
      "lapsed",
      "inactive",
      "suspended",
    ] as const;
    type Label = (typeof labels)[number];
    const ids = {} as Record<Label, string>;
    const labelOf = (id: string) => labels.find((label) => ids[label] === id) ?? id;

    /** Seeded labels the directory returns for the tag search plus `filters`, in order. */
    async function search(filters = ""): Promise<string[]> {
      const { body } = await admin(`tenants?search=${tag}${filters}`).expect(200);
      return body.tenants.map((tenant: { id: string }) => labelOf(tenant.id));
    }
    const sorted = (values: string[]) => [...values].sort();

    beforeAll(async () => {
      const plain = async (label: Label) => {
        const { cookie, email } = await signUp(app, uniqueEmail(`${tag}-${label}`));
        ids[label] = await userId(email);
        return cookie;
      };
      const seeded = async (label: Label) => {
        const account = await seedAccount(`${tag}-${label}`, 1);
        ids[label] = await userId(account.email);
        return account;
      };

      await plain("registered");
      await createBusiness(app, await plain("onboarding"), {
        displayName: `${tag}-shop Onboarding`,
      });
      await seeded("activated");
      await payPro((await seeded("subscribed")).cookie);
      // About five days left on a one-month run: Pro, ending soon.
      await plain("ending");
      await setSubscription(ids.ending, daysAgo(25), 1);
      // Made an invoice Ready, then a Pro month that ended a month ago.
      await seeded("lapsed");
      await setSubscription(ids.lapsed, daysAgo(60), 1);
      // Every meaningful action 40 days ago, and registered 45 days ago.
      await seeded("inactive");
      const old = daysAgo(40).toISOString();
      const owned = sql`(select id from businesses where owner_user_id = ${ids.inactive})`;
      await db().execute(
        sql`update invoices set created_at = ${old}::timestamptz where business_id in ${owned}`,
      );
      await db().execute(
        sql`update clients set created_at = ${old}::timestamptz where business_id in ${owned}`,
      );
      await db().execute(
        sql`update invoice_issuances set issued_at = ${old}::timestamptz where user_id = ${ids.inactive}`,
      );
      await setRegistered(ids.inactive, daysAgo(45));
      await plain("suspended");
      await db()
        .update(schema.users)
        .set({ banned: true })
        .where(eq(schema.users.id, ids.suspended));
      // Distinct names, so sorting by name has an order to check.
      for (const label of labels) {
        await db()
          .update(schema.users)
          .set({ name: `${label} ${tag}` })
          .where(eq(schema.users.id, ids[label]));
      }
    });

    it("finds every seeded account by part of their email", async () => {
      const { body } = await admin(`tenants?search=${tag.toUpperCase()}`).expect(200);
      expect(body.total).toBe(labels.length);
      expect(body.pageSize).toBe(25);
      expect(sorted(body.tenants.map((tenant: { id: string }) => labelOf(tenant.id)))).toEqual(
        sorted([...labels]),
      );
    });

    it("shows the three statuses for each account", async () => {
      const { body } = await admin(`tenants?search=${tag}`).expect(200);
      const statuses = Object.fromEntries(
        body.tenants.map(
          (tenant: {
            id: string;
            accountStatus: string;
            subscriptionStatus: string;
            lifecycleStage: string;
          }) => [
            labelOf(tenant.id),
            [tenant.accountStatus, tenant.subscriptionStatus, tenant.lifecycleStage],
          ],
        ),
      );
      expect(statuses).toEqual({
        registered: ["active", "free", "registered"],
        onboarding: ["active", "free", "onboarding"],
        activated: ["active", "free", "activated"],
        subscribed: ["active", "pro", "subscribed"],
        ending: ["active", "pro_ending", "subscribed"],
        lapsed: ["active", "lapsed", "activated"],
        inactive: ["active", "free", "inactive"],
        suspended: ["suspended", "free", "registered"],
      });
    });

    it("shows the row columns", async () => {
      const { body } = await admin(`tenants?search=${tag}&sort=name&dir=asc`).expect(200);
      const subscribed = body.tenants.find(
        (tenant: { id: string }) => tenant.id === ids.subscribed,
      );
      expect(subscribed).toMatchObject({
        owner: { name: `subscribed ${tag}`, email: expect.stringContaining(`${tag}-subscribed`) },
        role: "user",
        businesses: { firstName: "Seeded Studio", count: 1 },
        plan: { code: "pro", label: "Pro", proUntil: expect.any(String) },
        readyInvoices: 1,
      });
      expect(Date.parse(subscribed.lastMeaningfulActivityAt)).toBeGreaterThan(Date.now() - DAY_MS);
      const registered = body.tenants.find(
        (tenant: { id: string }) => tenant.id === ids.registered,
      );
      expect(registered).toMatchObject({
        businesses: { firstName: null, count: 0 },
        plan: { code: "free", label: "Free", proUntil: null },
        lastMeaningfulActivityAt: null,
        readyInvoices: 0,
      });
      // A lapsed account is on Free again.
      const lapsed = body.tenants.find((tenant: { id: string }) => tenant.id === ids.lapsed);
      expect(lapsed.plan).toEqual({ code: "free", label: "Free", proUntil: null });
    });

    it("marks admin accounts in the list, so the row menu can refuse to suspend them", async () => {
      const { body } = await admin(`tenants?search=${adminId}`).expect(200);
      expect(body.tenants).toEqual([expect.objectContaining({ id: adminId, role: "admin" })]);
    });

    it.each([
      ["&lifecycle=registered", ["registered", "suspended"]],
      ["&lifecycle=onboarding", ["onboarding"]],
      ["&lifecycle=activated", ["activated", "lapsed"]],
      ["&lifecycle=subscribed", ["subscribed", "ending"]],
      ["&lifecycle=inactive", ["inactive"]],
      [
        "&subscriptionStatus=free",
        ["registered", "onboarding", "activated", "inactive", "suspended"],
      ],
      ["&subscriptionStatus=pro", ["subscribed"]],
      ["&subscriptionStatus=pro_ending", ["ending"]],
      ["&subscriptionStatus=lapsed", ["lapsed"]],
      ["&accountStatus=suspended", ["suspended"]],
      ["&accountStatus=active&lifecycle=registered", ["registered"]],
      ["&signedUp=30", labels.filter((label) => label !== "inactive")],
      ["&signedUp=90", [...labels]],
      ["&activeWithin=7", ["activated", "subscribed", "lapsed"]],
      ["&activeWithin=90", ["activated", "subscribed", "lapsed", "inactive"]],
      ["&inactiveFor=30", ["registered", "onboarding", "ending", "inactive", "suspended"]],
    ])("filters with %s", async (filters, expected) => {
      expect(sorted(await search(filters))).toEqual(sorted(expected));
    });

    it("searches business names and exact account ids", async () => {
      expect(await search("-shop")).toEqual(["onboarding"]);
      const { body } = await admin(`tenants?search=${ids.lapsed}`).expect(200);
      expect(body.tenants.map((tenant: { id: string }) => tenant.id)).toEqual([ids.lapsed]);
    });

    it("sorts by each column in both directions", async () => {
      expect(await search("&sort=name&dir=asc")).toEqual(sorted([...labels]));
      expect(await search("&sort=name&dir=desc")).toEqual(sorted([...labels]).reverse());
      expect((await search("&sort=registered&dir=asc"))[0]).toBe("inactive");
      expect((await search("&sort=registered"))[labels.length - 1]).toBe("inactive");

      const ready = await search("&sort=readyInvoices&dir=desc");
      expect(sorted(ready.slice(0, 4))).toEqual(
        sorted(["activated", "subscribed", "lapsed", "inactive"]),
      );

      const { body } = await admin(`tenants?search=${tag}&sort=lastActivity&dir=desc`).expect(200);
      const times = body.tenants.map(
        (tenant: { lastMeaningfulActivityAt: string | null }) => tenant.lastMeaningfulActivityAt,
      );
      const known = times.filter((time: string | null) => time !== null);
      expect(known).toHaveLength(4);
      // Accounts with no activity come last, whichever the direction.
      expect(times.slice(0, 4)).toEqual([...known].sort().reverse());
      expect(labelOf(body.tenants[3].id)).toBe("inactive");
      const ascending = await search("&sort=lastActivity&dir=asc");
      expect(ascending[0]).toBe("inactive");
    });

    it("agrees with the domain status rules", async () => {
      const { body } = await admin(`tenants?search=${tag}`).expect(200);
      const now = new Date();
      for (const tenant of body.tenants) {
        const [subscription] = await db()
          .select()
          .from(schema.subscriptions)
          .where(eq(schema.subscriptions.userId, tenant.id));
        const entitlement = {
          anchorAt: subscription?.anchorAt ?? null,
          paidMonths: subscription?.paidMonths ?? 0,
        };
        const status = subscriptionStatus(entitlement, now);
        expect(tenant.subscriptionStatus).toBe(status);
        const businesses = await db()
          .select()
          .from(schema.businesses)
          .where(eq(schema.businesses.ownerUserId, tenant.id));
        expect(tenant.lifecycleStage).toBe(
          lifecycleStage(
            {
              businesses: businesses.length,
              readyInvoices: tenant.readyInvoices,
              proAccess: status === "pro" || status === "pro_ending",
              lastMeaningfulActivityAt: tenant.lastMeaningfulActivityAt
                ? new Date(tenant.lastMeaningfulActivityAt)
                : null,
            },
            now,
          ),
        );
      }
    });

    it("ends Pro on the same instant as the billing code", async () => {
      const anchors = [
        "2026-01-30T21:30:00Z", // 31 January, 00:30 in Nairobi
        "2027-01-28T21:00:00Z", // 29 January, before a short February
        "2028-02-28T22:00:00Z", // 29 February in a leap year
        "2026-03-30T21:00:00Z", // 31 March, midnight in Nairobi
        "2026-12-30T21:00:00Z", // 31 December
        "2026-10-15T20:59:59.999Z", // the last millisecond of a Nairobi day
        "2026-12-31T20:59:59.999Z", // the last millisecond of the year in Nairobi
      ];
      const months = Array.from({ length: 24 }, (_, index) => index + 1);
      for (const anchor of anchors) {
        const { rows } = await db().execute(sql`
          select m, to_char(${proEndsAtSql(sql`${anchor}::timestamptz`, sql`m`)}
            at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as ends
          from generate_series(1, 24) as m order by m`);
        expect(rows.map((row) => [anchor, row.m, row.ends])).toEqual(
          months.map((count) => [
            anchor,
            count,
            addNairobiMonths(new Date(anchor), count).toISOString(),
          ]),
        );
      }
    });

    it("matches the domain rules at every status boundary", async () => {
      const tenants = app.get(AdminTenantsService);
      const statusAt = async (email: string, now: Date) => {
        const page = await tenants.list(
          { page: 1, search: email, sort: "registered", dir: "desc" },
          now,
        );
        return page.tenants[0]!;
      };

      // Pro: a one-month run from 31 January (Nairobi), no business.
      const pro = await signUp(app, uniqueEmail("admin-boundary-pro"));
      const proId = await userId(pro.email);
      const anchor = new Date("2026-01-30T21:30:00Z");
      const end = addNairobiMonths(anchor, 1);
      await setSubscription(proId, anchor, 1);
      const at = (ms: number) => new Date(ms);
      const week = 7 * DAY_MS;
      const proCases: [string, Date, string, string][] = [
        ["anchor - 1ms", at(anchor.getTime() - 1), "free", "registered"],
        ["now == anchor", anchor, "pro", "subscribed"],
        ["end - 7d - 1ms", at(end.getTime() - week - 1), "pro", "subscribed"],
        ["end - 7d", at(end.getTime() - week), "pro_ending", "subscribed"],
        ["end - 1ms", at(end.getTime() - 1), "pro_ending", "subscribed"],
        ["now == end", end, "lapsed", "registered"],
      ];
      for (const [label, now, expectedStatus, expectedStage] of proCases) {
        const row = await statusAt(pro.email, now);
        const entitlement = { anchorAt: anchor, paidMonths: 1 };
        const domainStatus = subscriptionStatus(entitlement, now);
        const domainStage = lifecycleStage(
          {
            businesses: 0,
            readyInvoices: 0,
            proAccess: domainStatus === "pro" || domainStatus === "pro_ending",
            lastMeaningfulActivityAt: null,
          },
          now,
        );
        expect([label, row.subscriptionStatus, row.lifecycleStage]).toEqual([
          label,
          domainStatus,
          domainStage,
        ]);
        expect([label, domainStatus, domainStage]).toEqual([label, expectedStatus, expectedStage]);
      }

      // Inactive: every meaningful action at one instant, then exactly 30 days on.
      const active = await seedAccount("admin-boundary-active", 1);
      const activeId = await userId(active.email);
      const last = new Date("2026-03-01T10:00:00Z");
      const owned = sql`(select id from businesses where owner_user_id = ${activeId})`;
      const stamp = sql`${last.toISOString()}::timestamptz`;
      await db().execute(
        sql`update invoices set created_at = ${stamp} where business_id in ${owned}`,
      );
      await db().execute(
        sql`update clients set created_at = ${stamp} where business_id in ${owned}`,
      );
      await db().execute(
        sql`update invoice_issuances set issued_at = ${stamp} where user_id = ${activeId}`,
      );
      const thirty = last.getTime() + 30 * DAY_MS;
      for (const [label, now, expected] of [
        ["last + 30d", at(thirty), "activated"],
        ["last + 30d + 1ms", at(thirty + 1), "inactive"],
      ] as const) {
        const row = await statusAt(active.email, now);
        const domainStage = lifecycleStage(
          { businesses: 1, readyInvoices: 1, proAccess: false, lastMeaningfulActivityAt: last },
          now,
        );
        expect([label, row.lifecycleStage, domainStage]).toEqual([label, expected, expected]);
      }
    });

    it("pages 25 at a time without repeating rows", async () => {
      const bulk = `tb${crypto.randomUUID().slice(0, 8)}`;
      await db()
        .insert(schema.users)
        .values(
          Array.from({ length: 27 }, (_, index) => ({
            name: `Bulk ${index}`,
            email: `${bulk}-${index}@example.test`,
          })),
        );
      const first = await admin(`tenants?search=${bulk}`).expect(200);
      const second = await admin(`tenants?search=${bulk}&page=2`).expect(200);
      const third = await admin(`tenants?search=${bulk}&page=3`).expect(200);
      expect([first.body.total, first.body.tenants.length, second.body.tenants.length]).toEqual([
        27, 25, 2,
      ]);
      expect(third.body.tenants).toEqual([]);
      const seen = new Set(
        [...first.body.tenants, ...second.body.tenants].map((tenant: { id: string }) => tenant.id),
      );
      expect(seen.size).toBe(27);
    });
  });

  describe("tenant details", () => {
    it("shows identity, statuses, businesses, usage, subscription and audit", async () => {
      const account = await seedAccount("admin-detail", 1);
      const id = await userId(account.email);
      const paid = await payPro(account.cookie);
      await api()
        .put(`/api/v1/businesses/${account.businessId}/logo`)
        .set("Cookie", account.cookie)
        .set("Content-Type", "image/png")
        .send(PNG)
        .expect(200);
      const [client] = await db()
        .select()
        .from(schema.clients)
        .where(eq(schema.clients.businessId, account.businessId));
      const path = `/api/v1/businesses/${account.businessId}/invoices`;
      const newDraft = () =>
        api()
          .post(path)
          .set("Cookie", account.cookie)
          .send({
            clientId: client!.id,
            issueDate: "2026-10-16",
            dueDate: "2026-10-30",
            items: [{ description: "Design work", quantity: "1", unitPrice: "1000" }],
          })
          .expect(201);
      // One more Ready invoice, shared and part paid, and one left as a draft.
      const second = await newDraft();
      await api().post(`${path}/${second.body.id}/ready`).set("Cookie", account.cookie).expect(200);
      await api().post(`${path}/${second.body.id}/link`).set("Cookie", account.cookie).expect(201);
      await api()
        .post(`${path}/${second.body.id}/payments`)
        .set("Cookie", account.cookie)
        .send({ amount: "100", method: "mpesa", paymentDate: "2026-10-16" })
        .expect(201);
      await newDraft();

      const { body } = await admin(`tenants/${id}`).expect(200);
      expect(body.tenant).toMatchObject({
        id,
        owner: { email: account.email },
        businesses: { firstName: "Seeded Studio", count: 1 },
        plan: { code: "pro", label: "Pro" },
        accountStatus: "active",
        subscriptionStatus: "pro",
        lifecycleStage: "subscribed",
        readyInvoices: 2,
      });
      expect(body.identity).toEqual({
        emailVerified: false,
        role: "user",
        signInMethods: ["email"],
        suspendedReason: null,
      });
      expect(body.businesses).toEqual([
        {
          id: account.businessId,
          displayName: "Seeded Studio",
          profileType: "individual",
          createdAt: expect.any(String),
          contactEmail: "hello@wanjiku.example.test",
          phone: "+2547•••••678",
          clients: 1,
          invoices: { draft: 1, ready: 1, partially_paid: 1, paid: 0, cancelled: 0 },
          hasLogo: true,
          logoBytes: PNG.length,
        },
      ]);
      expect(body.usage).toEqual({
        // The Free invoice from before Pro is carried into the first Pro period.
        allowance: {
          plan: "pro",
          used: 2,
          limit: 100,
          periodStart: expect.any(String),
          periodEnd: expect.any(String),
          extraInvoices: 0,
        },
        credits: 0,
        invoicesCreated: 3,
        invoicesReady: 2,
        clients: 1,
        shareLinks: 1,
        paymentsRecorded: 1,
        storageBytes: PNG.length,
      });
      expect(body.subscription).toMatchObject({
        plan: { code: "pro" },
        status: "pro",
        paidMonths: 1,
        paidUntil: body.tenant.plan.proUntil,
        cancelledAt: null,
        payments: [
          expect.objectContaining({ receipt: paid, phone: "+2547•••••149", provider: "mpesa" }),
        ],
      });
      expect(body.recentAudit).toEqual([]);
      // Phone numbers only ever leave masked.
      expect(JSON.stringify(body)).not.toContain("712345678");
      expect(JSON.stringify(body)).not.toContain("708374149");
    });
  });

  describe("users directory and details", () => {
    const tag = `us${crypto.randomUUID().slice(0, 8)}`;
    const ids = { browser: "", google: "", silent: "" };

    beforeAll(async () => {
      // Signed up on a Mac, then signed in again from Windows over IPv6.
      const email = uniqueEmail(`${tag}-browser`);
      await api()
        .post("/api/v1/auth/sign-up/email")
        .set("Origin", WEB_ORIGIN)
        .set("User-Agent", CHROME_MAC)
        .set("X-Forwarded-For", "203.0.113.45")
        .send({ name: "Wanjiku Kamau", email, password: "correct-horse-battery" })
        .expect(200);
      await api()
        .post("/api/v1/auth/sign-in/email")
        .set("Origin", WEB_ORIGIN)
        .set(
          "User-Agent",
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
        )
        .set("X-Forwarded-For", "2001:db8:85a3::8a2e:370:7334")
        .send({ email, password: "correct-horse-battery" })
        .expect(200);
      ids.browser = await userId(email);

      const google = await signUp(app, uniqueEmail(`${tag}-google`));
      ids.google = await userId(google.email);
      await db()
        .insert(schema.accounts)
        .values({
          accountId: `google-${ids.google}`,
          providerId: "google",
          userId: ids.google,
          updatedAt: new Date(),
        });

      // Never signed in: no login method and no session.
      const [silent] = await db()
        .insert(schema.users)
        .values({ name: "Silent User", email: `${tag}-silent@example.test` })
        .returning();
      ids.silent = silent!.id;
    });

    const labelOf = (id: string) =>
      (Object.keys(ids) as (keyof typeof ids)[]).find((key) => ids[key] === id) ?? id;
    async function search(filters = ""): Promise<string[]> {
      const { body } = await admin(`users?search=${tag}${filters}`).expect(200);
      return body.users.map((user: { id: string }) => labelOf(user.id));
    }

    it("lists identity and access for each user", async () => {
      const { body } = await admin(`users?search=${tag}&sort=registered&dir=asc`).expect(200);
      expect(body.total).toBe(3);
      expect(body.users).toEqual([
        {
          id: ids.browser,
          name: "Wanjiku Kamau",
          email: expect.stringContaining(`${tag}-browser`),
          emailVerified: false,
          role: "user",
          accountStatus: "active",
          signInMethods: ["email"],
          registeredAt: expect.any(String),
          lastLoginAt: expect.any(String),
          tenantId: ids.browser,
        },
        expect.objectContaining({ id: ids.google, signInMethods: ["email", "google"] }),
        expect.objectContaining({ id: ids.silent, signInMethods: [], lastLoginAt: null }),
      ]);
    });

    it("filters by sign-in method, role and account status", async () => {
      expect(await search("&signInMethod=google")).toEqual(["google"]);
      expect((await search("&signInMethod=email")).sort()).toEqual(["browser", "google"]);
      expect(await search("&role=admin")).toEqual([]);
      const admins = await admin(`users?search=${encodeURIComponent(adminEmail)}&role=admin`);
      expect(admins.body.users).toEqual([expect.objectContaining({ id: adminId, role: "admin" })]);
      const notUsers = await admin(`users?search=${encodeURIComponent(adminEmail)}&role=user`);
      expect(notUsers.body.total).toBe(0);

      await db().update(schema.users).set({ banned: true }).where(eq(schema.users.id, ids.silent));
      expect(await search("&accountStatus=suspended")).toEqual(["silent"]);
      expect((await search("&accountStatus=active")).sort()).toEqual(["browser", "google"]);
    });

    it("sorts by last login with never-signed-in users last", async () => {
      expect(await search("&sort=lastLogin&dir=desc")).toEqual(["google", "browser", "silent"]);
      expect(await search("&sort=lastLogin&dir=asc")).toEqual(["browser", "google", "silent"]);
    });

    it("shows recent sessions with a device summary and a truncated IP", async () => {
      const { body } = await admin(`users/${ids.browser}`).expect(200);
      expect(body.user).toMatchObject({ id: ids.browser, tenantId: ids.browser });
      expect(body.sessions).toEqual([
        {
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          expiresAt: expect.any(String),
          device: { browser: "Firefox 132", os: "Windows" },
          ipAddress: "2001:db8:85a3::/48",
        },
        expect.objectContaining({
          device: { browser: "Chrome 130", os: "macOS" },
          ipAddress: "203.0.113.0/24",
        }),
      ]);
      expect(JSON.stringify(body)).not.toContain("203.0.113.45");
      expect(JSON.stringify(body)).not.toContain("7334");
      expect(body.recentAudit).toEqual([]);
    });
  });

  /*
   * Each action test seeds its own target, so any one of them can run alone or in any
   * order. The audit log API block builds its own history in beforeAll.
   */
  describe("actions", () => {
    const signIn = (email: string) =>
      api()
        .post("/api/v1/auth/sign-in/email")
        .set("Origin", WEB_ORIGIN)
        .send({ email, password: "correct-horse-battery" });
    const getSession = (cookie: string) =>
      api().get("/api/v1/auth/get-session").set("Cookie", cookie).expect(200);
    const userRow = async (id: string) =>
      (await db().select().from(schema.users).where(eq(schema.users.id, id)))[0]!;
    async function newTarget(label = "admin-action-target") {
      const account = await signUp(app, uniqueEmail(label));
      return { ...account, id: await userId(account.email) };
    }

    it("suspends with a reason: sign-in blocked, sessions ended, audited, directory fresh", async () => {
      const target = await newTarget();
      const directory = `tenants?search=${encodeURIComponent(target.email)}`;
      expect((await admin(directory).expect(200)).body.tenants[0].accountStatus).toBe("active");

      const response = await act(`tenants/${target.id}/suspend`, {
        reason: "  Chargeback fraud report  ",
      })
        .set("x-request-id", "e2e-suspend-1")
        .expect(200);
      expect(response.body).toMatchObject({ id: target.id, accountStatus: "suspended" });

      await api().get("/api/v1/businesses").set("Cookie", target.cookie).expect(401);
      expect((await signIn(target.email).expect(403)).body.code).toBe("BANNED_USER");
      // The cached directory entry was cleared, so the change shows at once.
      expect((await admin(directory).expect(200)).body.tenants[0].accountStatus).toBe("suspended");

      const [row] = await auditFor(target.id);
      expect(row).toMatchObject({
        actorUserId: adminId,
        actorRole: "admin",
        action: "tenant.suspend",
        targetType: "account",
        targetId: target.id,
        outcome: "success",
        reason: "Chargeback fraud report",
        changes: { banned: { from: false, to: true } },
        requestId: "e2e-suspend-1",
      });
      expect(row!.ipAddress).toBeTruthy();

      const detail = await admin(`tenants/${target.id}`).expect(200);
      expect(detail.body.identity.suspendedReason).toBe("Chargeback fraud report");
      expect(detail.body.recentAudit[0]).toMatchObject({
        action: "tenant.suspend",
        actor: { userId: adminId, role: "admin", email: adminEmail },
        target: { type: "account", id: target.id },
        outcome: "success",
      });
    });

    it("keeps a suspended account's shared invoice links working", async () => {
      const account = await seedAccount("admin-suspend-link", 1);
      const id = await userId(account.email);
      const [invoice] = await db()
        .select()
        .from(schema.invoices)
        .where(eq(schema.invoices.businessId, account.businessId));
      const link = await api()
        .post(`/api/v1/businesses/${account.businessId}/invoices/${invoice!.id}/link`)
        .set("Cookie", account.cookie)
        .expect(201);
      const token = link.body.token as string;

      await act(`tenants/${id}/suspend`).expect(200);
      await api().get(`/api/v1/public/invoices/${token}`).expect(200);
      await api().get(`/api/v1/public/invoices/${token}/pdf`).expect(200);
    });

    it("refuses to suspend an account twice, and records the refusal", async () => {
      const target = await newTarget();
      await act(`tenants/${target.id}/suspend`).expect(200);
      const response = await act(`tenants/${target.id}/suspend`).expect(409);
      expect(response.body).toEqual({
        code: "ALREADY_SUSPENDED",
        message: "This account is already suspended.",
      });
      expect((await auditFor(target.id)).at(-1)).toMatchObject({
        action: "tenant.suspend",
        outcome: "failure",
        reason: "Checked with the owner",
        changes: { error: { status: 409, code: "ALREADY_SUSPENDED" } },
      });
    });

    it("reactivates, after which sign-in works, and refuses an active account", async () => {
      const target = await newTarget();
      await act(`tenants/${target.id}/suspend`).expect(200);
      const response = await act(`tenants/${target.id}/reactivate`).expect(200);
      expect(response.body).toMatchObject({ id: target.id, accountStatus: "active" });
      const back = await signIn(target.email).expect(200);
      await api()
        .get("/api/v1/businesses")
        .set("Cookie", sessionCookie(back.headers["set-cookie"]))
        .expect(200);

      const again = await act(`tenants/${target.id}/reactivate`).expect(409);
      expect(again.body.code).toBe("NOT_SUSPENDED");
      const rows = await auditFor(target.id);
      expect(rows.slice(-2)).toEqual([
        expect.objectContaining({
          action: "tenant.reactivate",
          outcome: "success",
          changes: { banned: { from: true, to: false } },
        }),
        expect.objectContaining({ action: "tenant.reactivate", outcome: "failure" }),
      ]);
    });

    it("refuses to suspend yourself or another admin", async () => {
      const self = await act(`tenants/${adminId}/suspend`).expect(409);
      expect(self.body.code).toBe("CANNOT_SUSPEND_SELF");
      await admin("access").expect(204);
      expect((await auditFor(adminId)).at(-1)).toMatchObject({
        action: "tenant.suspend",
        outcome: "failure",
        changes: { error: { code: "CANNOT_SUSPEND_SELF" } },
      });

      const other = await newTarget("admin-other");
      await db().update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, other.id));
      try {
        const response = await act(`tenants/${other.id}/suspend`).expect(409);
        expect(response.body.code).toBe("CANNOT_SUSPEND_ADMIN");
        expect((await userRow(other.id)).banned).toBe(false);
        expect((await auditFor(other.id)).at(-1)).toMatchObject({ outcome: "failure" });
      } finally {
        // Back to a plain user, so the role-sync assertions see no stray admin.
        await db().update(schema.users).set({ role: "user" }).where(eq(schema.users.id, other.id));
      }
    });

    it("revokes every session without suspending", async () => {
      const target = await newTarget();
      const second = sessionCookie((await signIn(target.email).expect(200)).headers["set-cookie"]);
      const response = await act(`users/${target.id}/revoke-sessions`).expect(200);
      expect(response.body).toMatchObject({
        id: target.id,
        accountStatus: "active",
        lastLoginAt: null,
      });
      await api().get("/api/v1/businesses").set("Cookie", target.cookie).expect(401);
      await api().get("/api/v1/businesses").set("Cookie", second).expect(401);
      await signIn(target.email).expect(200);
      expect((await auditFor(target.id)).at(-1)).toMatchObject({
        action: "user.revoke_sessions",
        targetType: "user",
        outcome: "success",
        changes: { sessions: { from: 2, to: 0 } },
      });
      const detail = await admin(`users/${target.id}`).expect(200);
      expect(detail.body.recentAudit[0]).toMatchObject({ action: "user.revoke_sessions" });
    });

    it("refuses to revoke your own sessions, but revokes another admin's", async () => {
      const self = await act(`users/${adminId}/revoke-sessions`).expect(409);
      expect(self.body).toEqual({
        code: "CANNOT_REVOKE_SELF",
        message: "You can't revoke your own sessions here.",
      });
      await admin("access").expect(204);
      expect((await auditFor(adminId)).at(-1)).toMatchObject({
        action: "user.revoke_sessions",
        outcome: "failure",
        changes: { error: { status: 409, code: "CANNOT_REVOKE_SELF" } },
      });

      // The answer to a stolen admin session: sign that admin out everywhere.
      const other = await newTarget("admin-stolen");
      await db().update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, other.id));
      try {
        await api().get("/api/v1/admin/access").set("Cookie", other.cookie).expect(204);
        await act(`users/${other.id}/revoke-sessions`).expect(200);
        await api().get("/api/v1/admin/access").set("Cookie", other.cookie).expect(404);
        expect((await auditFor(other.id)).at(-1)).toMatchObject({
          action: "user.revoke_sessions",
          outcome: "success",
        });
      } finally {
        await db().update(schema.users).set({ role: "user" }).where(eq(schema.users.id, other.id));
      }
    });

    it("rolls the change back and records a failure when the audit row cannot be written", async () => {
      const target = await newTarget();
      const audit = app.get(AuditService);
      const original = audit.record.bind(audit);
      // Only the in-transaction (success) write fails; the failure row still lands.
      const spy = vi
        .spyOn(audit, "record")
        .mockImplementation((entry, executor) =>
          executor ? Promise.reject(new Error("audit insert failed")) : original(entry),
        );
      try {
        await act(`tenants/${target.id}/suspend`).expect(500);
      } finally {
        spy.mockRestore();
      }
      expect((await userRow(target.id)).banned).toBe(false);
      await api().get("/api/v1/businesses").set("Cookie", target.cookie).expect(200);
      expect(await auditFor(target.id)).toEqual([
        expect.objectContaining({
          action: "tenant.suspend",
          outcome: "failure",
          changes: { error: { status: 500, message: "Unexpected error" } },
        }),
      ]);
    });

    it("returns the original error when the failure row cannot be written either", async () => {
      const target = await newTarget();
      await db().update(schema.users).set({ banned: true }).where(eq(schema.users.id, target.id));
      const spy = vi
        .spyOn(app.get(AuditService), "record")
        .mockRejectedValue(new Error("audit down"));
      try {
        const response = await act(`tenants/${target.id}/suspend`).expect(409);
        expect(response.body.code).toBe("ALREADY_SUSPENDED");
      } finally {
        spy.mockRestore();
      }
      expect(await auditFor(target.id)).toEqual([]);
    });

    it("answers 200 with ok when the change committed but its summary could not be read", async () => {
      const target = await newTarget();
      const spy = vi
        .spyOn(app.get(AdminTenantsService), "summary")
        .mockRejectedValueOnce(new Error("read replica down"));
      try {
        const response = await act(`tenants/${target.id}/suspend`).expect(200);
        expect(response.body).toEqual({ ok: true });
      } finally {
        spy.mockRestore();
      }
      expect((await userRow(target.id)).banned).toBe(true);
      expect((await auditFor(target.id)).at(-1)).toMatchObject({ outcome: "success" });
    });

    it.each(["tenants/%s/suspend", "tenants/%s/reactivate", "users/%s/revoke-sessions"])(
      "answers 404 on %s for an unknown or malformed id, recording unknown ones",
      async (route) => {
        const unknown = crypto.randomUUID();
        await act(route.replace("%s", unknown)).expect(404);
        await act(route.replace("%s", "not-a-uuid")).expect(404);
        expect(await auditFor(unknown)).toEqual([
          expect.objectContaining({
            outcome: "failure",
            changes: { error: expect.objectContaining({ status: 404 }) },
          }),
        ]);
      },
    );

    it.each(["tenants/%s/suspend", "tenants/%s/reactivate", "users/%s/revoke-sessions"])(
      "answers 400 on %s without a reason of at least 5 characters",
      async (route) => {
        const target = await newTarget();
        const path = route.replace("%s", target.id);
        await act(path, {}).expect(400);
        const short = await act(path, { reason: "  abc  " }).expect(400);
        expect(short.body.issues).toEqual([expect.objectContaining({ path: "reason" })]);
        expect(await auditFor(target.id)).toEqual([]);
        expect((await userRow(target.id)).banned).toBe(false);
      },
    );

    it.each(["tenants/%s/suspend", "tenants/%s/reactivate", "users/%s/revoke-sessions"])(
      "answers 404 on %s to a signed-out visitor or a non-admin",
      async (route) => {
        const target = await newTarget();
        const path = route.replace("%s", target.id);
        const { cookie } = await signUp(app);
        await api()
          .post(`/api/v1/admin/${path}`)
          .send({ reason: "Checked with the owner" })
          .expect(404);
        await act(path, { reason: "Checked with the owner" }, cookie).expect(404);
        expect((await userRow(target.id)).banned).toBe(false);
        expect(await auditFor(target.id)).toEqual([]);
      },
    );

    it("allows 10 actions a minute per admin and answers 429 after that", async () => {
      // An app of its own, so its limiter starts empty and this file's main app is untouched.
      const limited = await appWithAdmins([adminId]);
      try {
        const post = () =>
          request(limited.app.getHttpServer())
            .post(`/api/v1/admin/users/${crypto.randomUUID()}/revoke-sessions`)
            .set("Cookie", adminCookie)
            .send({ reason: "Checked with the owner" });
        for (let index = 0; index < 10; index++) await post().expect(404);
        const refused = await post().expect(429);
        expect(refused.headers["retry-after"]).toMatch(/^\d+$/);
      } finally {
        await limited.app.close();
      }
    });

    it("hides a surviving session of a suspended account from get-session", async () => {
      const { cookie, id } = await newTarget("admin-get-session");
      expect((await getSession(cookie)).body.user.id).toBe(id);
      // Banned straight in the table, so the session row survives.
      await db().update(schema.users).set({ banned: true }).where(eq(schema.users.id, id));
      expect((await getSession(cookie)).body).toBeNull();
      await db().update(schema.users).set({ banned: false }).where(eq(schema.users.id, id));
      expect((await getSession(cookie)).body.user.id).toBe(id);
    });

    describe("audit log API", () => {
      let target: { id: string; email: string; cookie: string };
      const auditLogs = async (filters: string) =>
        (await admin(`audit-logs?targetId=${target.id}${filters}`).expect(200)).body;

      beforeAll(async () => {
        target = await newTarget("admin-audit-history");
        await act(`tenants/${target.id}/suspend`, { reason: "Chargeback fraud report" })
          .set("x-request-id", "e2e-audit-1")
          .expect(200);
        await act(`tenants/${target.id}/suspend`).expect(409);
        await act(`tenants/${target.id}/reactivate`).expect(200);
        await act(`tenants/${target.id}/reactivate`).expect(409);
        await act(`users/${target.id}/revoke-sessions`).expect(200);
      });

      it("lists rows newest first with the actor and a truncated IP", async () => {
        const body = await auditLogs("");
        expect(body.pageSize).toBe(50);
        expect(body.total).toBe(5);
        expect(
          body.entries.map(
            (entry: { action: string; outcome: string }) => `${entry.action}:${entry.outcome}`,
          ),
        ).toEqual([
          "user.revoke_sessions:success",
          "tenant.reactivate:failure",
          "tenant.reactivate:success",
          "tenant.suspend:failure",
          "tenant.suspend:success",
        ]);
        const oldest = body.entries.at(-1);
        expect(oldest).toMatchObject({
          actor: { userId: adminId, role: "admin", email: adminEmail },
          target: { type: "account", id: target.id },
          reason: "Chargeback fraud report",
          requestId: "e2e-audit-1",
        });
        // The table keeps the full address; the API shows only the network.
        const [stored] = await auditFor(target.id);
        expect(stored!.ipAddress).toBeTruthy();
        expect(oldest.ipAddress).toMatch(/\/(24|48)$/);
        expect(oldest.ipAddress).not.toBe(stored!.ipAddress);
      });

      it("filters by action, outcome, target type, actor and date", async () => {
        expect((await auditLogs("&action=tenant.suspend")).total).toBe(2);
        expect((await auditLogs("&action=tenant.suspend&outcome=failure")).total).toBe(1);
        expect((await auditLogs("&targetType=user")).entries).toEqual([
          expect.objectContaining({ action: "user.revoke_sessions" }),
        ]);
        expect((await auditLogs(`&actorId=${adminId}`)).total).toBe(5);
        expect((await auditLogs(`&actorId=${crypto.randomUUID()}`)).total).toBe(0);

        const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() + 3 * 60 * 60 * 1000 - DAY_MS)
          .toISOString()
          .slice(0, 10);
        expect((await auditLogs(`&from=${today}&to=${today}`)).total).toBe(5);
        expect((await auditLogs(`&to=${yesterday}`)).total).toBe(0);
        expect(
          (await admin("audit-logs?action=user.role_change&outcome=success").expect(200)).body
            .entries[0],
        ).toMatchObject({ actor: { userId: null, role: "system", email: null } });
      });
    });
  });

  subscriptionSuite({
    app: () => app,
    adminCookie: () => adminCookie,
    adminId: () => adminId,
    seedAccount,
    payPro,
    userId,
  });
});
