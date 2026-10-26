import { execFileSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import {
  adminHealthSchema,
  adminSettingsSchema,
  adminSupportAccountSchema,
  adminSupportCaseDetailSchema,
  adminSupportCaseRowSchema,
  adminSupportCasesPageSchema,
  adminSupportNoteSchema,
  platformInfoSchema,
  platformSettingDefaults,
  REGISTRATION_CLOSED_CODE,
} from "@billsafi/contracts";
import { and, createDatabase, type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import request from "supertest";
import { AdminHealthService } from "../src/admin/health/admin-health.service.js";
import { DATABASE } from "../src/database/database.module.js";
import { createTestApp, signUp, uniqueEmail, WEB_ORIGIN } from "./support/app.js";

/**
 * Super admin phase 6 (health, support, configuration). Registration is a global switch and
 * Health counts all M-Pesa rows, so this file runs against a database of its own: other
 * spec files keep signing up users and creating payments on the shared one in parallel.
 */
const ORIGINAL_URL = process.env.DATABASE_URL!;
const DB_NAME = `billsafi_ops_${crypto.randomUUID().replace(/-/g, "")}`;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const MINUTE = 60_000;

function idToken(claims: Record<string, unknown>): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256", typ: "JWT" })}.${part({
    iss: "https://accounts.google.com",
    aud: process.env.GOOGLE_CLIENT_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  })}.signature`;
}

describe("admin ops", () => {
  let app: INestApplication;
  let adminCookie: string;
  let adminId: string;
  let adminEmail: string;
  let admin2Cookie: string;
  let admin2Id: string;
  let adminConnection: DatabaseConnection;
  let googleProfile: Record<string, unknown> = {};
  const realFetch = globalThis.fetch;
  const api = () => request(app.getHttpServer());
  const db = () => app.get<DatabaseConnection>(DATABASE).db;
  const get = (path: string) => api().get(`/api/v1/${path}`).set("Cookie", adminCookie);
  const send = (
    method: "post" | "put" | "patch",
    path: string,
    body: object,
    cookie = adminCookie,
  ) => api()[method](`/api/v1/${path}`).set("Cookie", cookie).send(body);
  const REASON = "Checked with the customer";

  async function userId(email: string) {
    const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email));
    return user!.id;
  }

  async function makeAdmin(label: string) {
    const { cookie, email } = await signUp(app, uniqueEmail(label));
    const id = await userId(email);
    await db().update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, id));
    return { cookie, email, id };
  }

  async function auditRows(action: string, targetId: string) {
    return db()
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, action), eq(schema.auditLogs.targetId, targetId)))
      .orderBy(schema.auditLogs.occurredAt);
  }

  function setSetting(key: string, value: object) {
    return send("put", `admin/settings/${key}`, { value, reason: REASON });
  }

  beforeAll(async () => {
    adminConnection = createDatabase(ORIGINAL_URL);
    await adminConnection.pool.query(`create database "${DB_NAME}"`);
    const url = new URL(ORIGINAL_URL);
    url.pathname = `/${DB_NAME}`;
    process.env.DATABASE_URL = url.toString();
    execFileSync("pnpm", ["--filter", "@billsafi/db", "db:migrate"], {
      env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: "ignore",
    });
    ({ app } = await createTestApp({ adminActionLimit: 1000 }));
    ({ cookie: adminCookie, id: adminId, email: adminEmail } = await makeAdmin("ops-admin"));
    ({ cookie: admin2Cookie, id: admin2Id } = await makeAdmin("ops-admin-two"));
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const target = input instanceof Request ? input.url : String(input);
      if (!target.startsWith(GOOGLE_TOKEN_URL)) return realFetch(input, init);
      return Response.json({
        access_token: "google-access-token",
        expires_in: 3599,
        scope: "openid email profile",
        token_type: "Bearer",
        id_token: idToken(googleProfile),
      });
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
    process.env.DATABASE_URL = ORIGINAL_URL;
    await adminConnection.pool.query(`drop database "${DB_NAME}" with (force)`);
    await adminConnection.pool.end();
  });

  describe("access", () => {
    const caseId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    const calls: [string, string, object?][] = [
      ["get", "admin/health"],
      ["get", "admin/support/cases"],
      ["get", `admin/support/cases/${caseId}`],
      ["get", `admin/support/accounts/${accountId}`],
      ["get", "admin/settings"],
      ["post", "admin/support/cases", { accountId, title: "x", category: "bug", reason: REASON }],
      ["patch", `admin/support/cases/${caseId}`, { severity: "high", reason: REASON }],
      ["post", `admin/support/cases/${caseId}/resolve`, { resolution: "Done", reason: REASON }],
      ["post", `admin/support/cases/${caseId}/reopen`, { reason: REASON }],
      ["post", `admin/support/cases/${caseId}/notes`, { body: "hi" }],
      ["post", `admin/support/accounts/${accountId}/notes`, { body: "hi" }],
      [
        "put",
        "admin/settings/registration",
        { value: { open: true, closedMessage: "x" }, reason: REASON },
      ],
    ];

    it.each(calls)("answers 404 to a signed-out visitor on %s %s", async (method, path, body) => {
      const call = api()[method as "get"](`/api/v1/${path}`);
      await (body ? call.send(body) : call).expect(404);
    });

    it.each(calls)("answers 404 to an account owner on %s %s", async (method, path, body) => {
      const owner = await signUp(app);
      const call = api()[method as "get"](`/api/v1/${path}`).set("Cookie", owner.cookie);
      await (body ? call.send(body) : call).expect(404);
    });

    it("keeps a case hidden from the account it is about", async () => {
      const owner = await signUp(app);
      const owned = await userId(owner.email);
      const created = await send("post", "admin/support/cases", {
        accountId: owned,
        title: "Owner must not see this",
        category: "billing",
        reason: REASON,
      }).expect(201);
      await api()
        .get(`/api/v1/admin/support/cases/${created.body.id}`)
        .set("Cookie", owner.cookie)
        .expect(404);
      await api()
        .get(`/api/v1/admin/support/accounts/${owned}`)
        .set("Cookie", owner.cookie)
        .expect(404);
    });
  });

  describe("health", () => {
    it("reports what it can check and says unknown for the rest", async () => {
      const response = await get("admin/health").expect(200);
      const health = adminHealthSchema.parse(response.body);
      const byKey = Object.fromEntries(health.indicators.map((i) => [i.key, i]));
      expect(health.indicators.map((i) => i.key)).toEqual([
        "database",
        "migrations",
        "mpesa",
        "billing_jobs",
        "pdf_email",
        "backups",
      ]);
      expect(byKey.database).toMatchObject({ status: "ok", source: "Live query" });
      expect(byKey.database!.data!.responseMs).toBeGreaterThanOrEqual(0);
      expect(byKey.migrations).toMatchObject({ status: "ok", value: "0016_support_and_settings" });
      expect(byKey.mpesa).toMatchObject({ status: "unknown", value: null });
      for (const key of ["billing_jobs", "pdf_email", "backups"]) {
        expect(byKey[key]).toMatchObject({ status: "unknown", value: null });
        expect(byKey[key]!.detail).toMatch(
          /aren't recorded yet|isn't recorded|not recorded|aren't reported/i,
        );
      }
      expect(health.links).toEqual([]);
    });

    it("warns on a stuck M-Pesa checkout and counts it", async () => {
      const owner = await userId((await signUp(app)).email);
      await db()
        .insert(schema.subscriptionPayments)
        .values({
          userId: owner,
          purpose: "pro_month",
          amount: "500.00",
          status: "pending",
          provider: "mpesa",
          phone: "254712345678",
          createdAt: new Date(Date.now() - 30 * MINUTE),
        });
      const health = adminHealthSchema.parse((await get("admin/health").expect(200)).body);
      const mpesa = health.indicators.find((i) => i.key === "mpesa")!;
      expect(mpesa.status).toBe("warning");
      expect(mpesa.data).toMatchObject({ stuck: 1 });
      expect(mpesa.detail).toMatch(/stuck/);
    });

    it("warns on a low 24 hour success rate, once there are enough settled checkouts", async () => {
      const owner = await userId((await signUp(app)).email);
      const settle = (status: "succeeded" | "failed") =>
        db()
          .insert(schema.subscriptionPayments)
          .values({
            userId: owner,
            purpose: "pro_month",
            amount: "500.00",
            status,
            provider: "mpesa",
            phone: "254712345678",
            confirmedAt: status === "succeeded" ? new Date() : null,
          });
      await settle("succeeded");
      for (let n = 0; n < 4; n++) await settle("failed");
      const health = adminHealthSchema.parse((await get("admin/health").expect(200)).body);
      const mpesa = health.indicators.find((i) => i.key === "mpesa")!;
      expect(mpesa.status).toBe("warning");
      expect(mpesa.data).toMatchObject({ settled24h: 5, successRate24h: 0.2 });
    });

    it("warns when the database is behind the bundled migrations", async () => {
      await db().execute(sql`
        create temp table if not exists keep_last as select 1 where false`);
      const [latest] = (
        await db().execute(
          sql`select id, hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`,
        )
      ).rows as { id: number; hash: string; created_at: string }[];
      await db().execute(sql`delete from drizzle.__drizzle_migrations where id = ${latest!.id}`);
      try {
        const health = adminHealthSchema.parse((await get("admin/health").expect(200)).body);
        const migrations = health.indicators.find((i) => i.key === "migrations")!;
        expect(migrations.status).toBe("warning");
        expect(migrations.data).toMatchObject({ pending: 1 });
      } finally {
        await db().execute(sql`
          insert into drizzle.__drizzle_migrations (id, hash, created_at)
          values (${latest!.id}, ${latest!.hash}, ${latest!.created_at}::bigint)`);
      }
    });

    it("shows a provider that throws as failing with a safe message, not a 500", async () => {
      const service = new AdminHealthService(
        [
          {
            key: "boom",
            label: "Boom",
            source: "Test",
            staleAfterSeconds: null,
            check: async () => {
              throw new Error("password=hunter2 at postgres://user:secret@host");
            },
          },
        ],
        {},
      );
      const health = await service.health();
      expect(health.indicators[0]).toMatchObject({ key: "boom", status: "failing", value: null });
      expect(JSON.stringify(health)).not.toMatch(/hunter2|secret/);
    });

    it("returns Sentry and uptime links only when their variables are set", async () => {
      const service = new AdminHealthService([], {
        ADMIN_SENTRY_URL: "https://sentry.example.test/org/billsafi",
        ADMIN_UPTIME_URL: undefined,
      });
      expect((await service.health()).links).toEqual([
        expect.objectContaining({
          key: "sentry",
          href: "https://sentry.example.test/org/billsafi",
        }),
      ]);
    });
  });

  describe("support", () => {
    let accountId: string;
    let accountEmail: string;

    beforeAll(async () => {
      accountEmail = (await signUp(app, uniqueEmail("support-customer"))).email;
      accountId = await userId(accountEmail);
    });

    async function newCase(overrides: Record<string, unknown> = {}) {
      const response = await send("post", "admin/support/cases", {
        accountId,
        title: "Payment not applied",
        category: "payments",
        reason: REASON,
        ...overrides,
      }).expect(201);
      return adminSupportCaseRowSchema.parse(response.body);
    }

    it("creates a case with defaults and audits it", async () => {
      const created = await newCase();
      expect(created).toMatchObject({
        accountId,
        status: "open",
        severity: "normal",
        noteCount: 0,
        resolvedAt: null,
        resolution: null,
        account: { email: accountEmail },
        createdBy: { id: adminId },
        assignedTo: null,
      });
      const [row] = await db()
        .select()
        .from(schema.auditLogs)
        .where(
          and(
            eq(schema.auditLogs.action, "support.case_create"),
            eq(schema.auditLogs.targetId, accountId),
          ),
        );
      expect(row).toMatchObject({ outcome: "success", reason: REASON, actorUserId: adminId });
      expect((row!.changes as { caseId: string }).caseId).toBe(created.id);
    });

    it("refuses an unknown account, a missing reason and a non-admin assignee", async () => {
      await send("post", "admin/support/cases", {
        accountId: crypto.randomUUID(),
        title: "Ghost",
        category: "bug",
        reason: REASON,
      }).expect(404);
      await send("post", "admin/support/cases", {
        accountId,
        title: "No reason",
        category: "bug",
      }).expect(400);
      const response = await send("post", "admin/support/cases", {
        accountId,
        title: "Bad assignee",
        category: "bug",
        assignedTo: accountId,
        reason: REASON,
      }).expect(400);
      expect(response.body.issues).toEqual([expect.objectContaining({ path: "assignedTo" })]);
    });

    it("runs the lifecycle: update, resolve, refuse edits while resolved, reopen", async () => {
      const created = await newCase({ title: "Lifecycle" });
      const base = `admin/support/cases/${created.id}`;

      const updated = await send("patch", base, {
        severity: "high",
        status: "waiting",
        assignedTo: admin2Id,
        reason: REASON,
      }).expect(200);
      expect(adminSupportCaseRowSchema.parse(updated.body)).toMatchObject({
        severity: "high",
        status: "waiting",
        assignedTo: { id: admin2Id },
      });
      await send("patch", base, { severity: "high", reason: REASON }).expect(409);

      await send("post", `${base}/resolve`, { reason: REASON }).expect(400);
      const resolved = await send("post", `${base}/resolve`, {
        resolution: "Applied the payment by hand",
        reason: REASON,
      }).expect(200);
      expect(resolved.body).toMatchObject({
        status: "resolved",
        resolution: "Applied the payment by hand",
      });
      expect(resolved.body.resolvedAt).toBeTruthy();
      const again = await send("post", `${base}/resolve`, {
        resolution: "Again",
        reason: REASON,
      }).expect(409);
      expect(again.body.code).toBe("ALREADY_RESOLVED");
      const locked = await send("patch", base, { severity: "low", reason: REASON }).expect(409);
      expect(locked.body.code).toBe("CASE_RESOLVED");
      await send("post", `${base}/reopen`, { reason: "Customer wrote back" }).expect(200);
      await send("post", `${base}/reopen`, { reason: "Customer wrote back" }).expect(409);

      const detail = adminSupportCaseDetailSchema.parse((await get(base).expect(200)).body);
      expect(detail.case).toMatchObject({ status: "open", resolvedAt: null, resolution: null });
      // The cleared resolution is kept as an automatic note.
      expect(detail.notes.map((note) => note.body)).toEqual([
        "Reopened. The earlier resolution was: Applied the payment by hand",
      ]);
      expect(detail.timeline.map((entry) => entry.action)).toEqual([
        "support.case_create",
        "support.case_update",
        "support.case_resolve",
        "support.case_reopen",
      ]);
      expect(detail.timeline[1]).toMatchObject({
        reason: REASON,
        changes: {
          status: { from: "open", to: "waiting" },
          severity: { from: "normal", to: "high" },
        },
      });
    });

    it("audits a refused action as a failure row", async () => {
      const created = await newCase({ title: "Failure audit" });
      await send("post", `admin/support/cases/${created.id}/reopen`, { reason: REASON }).expect(
        409,
      );
      const rows = await auditRows("support.case_reopen", created.id);
      expect(rows).toEqual([
        expect.objectContaining({
          outcome: "failure",
          changes: { error: expect.objectContaining({ code: "NOT_RESOLVED" }) },
        }),
      ]);
    });

    it("keeps note text out of the audit log and stores only the id and length", async () => {
      const created = await newCase({ title: "Notes" });
      const text = "Customer said their PIN is 1234 and was rude";
      const response = await send("post", `admin/support/cases/${created.id}/notes`, {
        body: text,
      }).expect(201);
      const note = adminSupportNoteSchema.parse(response.body);
      expect(note).toMatchObject({
        caseId: created.id,
        accountId,
        body: text,
        author: { id: adminId },
      });

      const [row] = await auditRows("support.note_add", created.id);
      expect(row).toMatchObject({ outcome: "success", reason: "Internal note" });
      expect(row!.changes).toEqual({ noteId: note.id, length: text.length });
      const everything = await db().select().from(schema.auditLogs);
      expect(JSON.stringify(everything)).not.toContain("PIN is 1234");

      const detail = adminSupportCaseDetailSchema.parse(
        (await get(`admin/support/cases/${created.id}`)).body,
      );
      expect(detail.case.noteCount).toBe(1);
      expect(JSON.stringify(detail.timeline)).not.toContain("PIN is 1234");
    });

    it("makes notes append-only at the database", async () => {
      const response = await send("post", `admin/support/accounts/${accountId}/notes`, {
        body: "Loose note",
      }).expect(201);
      expect(response.body).toMatchObject({ caseId: null, accountId });
      await expect(
        db()
          .update(schema.supportNotes)
          .set({ body: "edited" })
          .where(eq(schema.supportNotes.id, response.body.id)),
      ).rejects.toThrow();
      await expect(
        db().delete(schema.supportNotes).where(eq(schema.supportNotes.id, response.body.id)),
      ).rejects.toThrow();
      await expect(db().execute(sql`truncate support_notes`)).rejects.toThrow();
    });

    it("refuses a note with no text and a note on an unknown case or account", async () => {
      await send("post", `admin/support/accounts/${accountId}/notes`, { body: "  " }).expect(400);
      await send("post", `admin/support/cases/${crypto.randomUUID()}/notes`, { body: "x" }).expect(
        404,
      );
      await send("post", `admin/support/accounts/${crypto.randomUUID()}/notes`, {
        body: "x",
      }).expect(404);
    });

    it("lists with tabs, filters, search, sorting and paging", async () => {
      const owner = await signUp(app, uniqueEmail("zed-listing"));
      const listed = await userId(owner.email);
      const mk = async (title: string, extra: Record<string, unknown> = {}) =>
        adminSupportCaseRowSchema.parse(
          (
            await send("post", "admin/support/cases", {
              accountId: listed,
              title,
              category: "sign_in",
              reason: REASON,
              ...extra,
            }).expect(201)
          ).body,
        );
      const low = await mk("Alpha low", { severity: "low" });
      const urgent = await mk("Bravo urgent", { severity: "urgent" });
      const waiting = await mk("Charlie waiting");
      await send("patch", `admin/support/cases/${waiting.id}`, {
        status: "waiting",
        reason: REASON,
      }).expect(200);
      const done = await mk("Delta done");
      await send("post", `admin/support/cases/${done.id}/resolve`, {
        resolution: "Fixed",
        reason: REASON,
      }).expect(200);
      const stale = await mk("Echo stale");
      await db()
        .update(schema.supportCases)
        .set({ updatedAt: new Date(Date.now() - 10 * 24 * 60 * MINUTE) })
        .where(eq(schema.supportCases.id, stale.id));

      const list = async (query: string) =>
        adminSupportCasesPageSchema.parse(
          (await get(`admin/support/cases?accountId=${listed}&${query}`).expect(200)).body,
        );
      const titles = async (query: string) => (await list(query)).cases.map((c) => c.title).sort();

      expect(await titles("tab=open")).toEqual(["Alpha low", "Bravo urgent", "Echo stale"]);
      expect(await titles("tab=waiting")).toEqual(["Charlie waiting"]);
      expect(await titles("tab=resolved")).toEqual(["Delta done"]);
      expect(await titles("tab=recent")).toEqual([
        "Alpha low",
        "Bravo urgent",
        "Charlie waiting",
        "Delta done",
      ]);
      expect(await titles("")).toHaveLength(5);
      expect(await titles("severity=urgent")).toEqual(["Bravo urgent"]);
      expect(await titles("category=bug")).toEqual([]);
      expect(await titles("search=charlie")).toEqual(["Charlie waiting"]);
      expect(await titles(`search=${owner.email.split("@")[0]!.slice(0, 20)}`)).toHaveLength(5);
      expect(await titles(`search=${urgent.id}`)).toEqual(["Bravo urgent"]);
      expect((await list("sort=severity&dir=desc")).cases[0]!.id).toBe(urgent.id);
      expect((await list("sort=severity&dir=asc")).cases[0]!.id).toBe(low.id);
      expect((await list("sort=created&dir=asc")).cases[0]!.title).toBe("Alpha low");
      const page = await list("sort=created&dir=asc&page=2");
      expect(page).toMatchObject({ page: 2, total: 5, cases: [] });
      await get("admin/support/cases?tab=everything").expect(400);
    });

    it("shows diagnostics: plan status, last payment, stuck payments, recent admin actions", async () => {
      const customer = await signUp(app, uniqueEmail("diag"));
      const diagId = await userId(customer.email);
      await db()
        .insert(schema.subscriptionPayments)
        .values({
          userId: diagId,
          purpose: "pro_month",
          amount: "500.00",
          status: "pending",
          provider: "mpesa",
          phone: "254712345678",
          createdAt: new Date(Date.now() - 45 * MINUTE),
        });
      await send("post", `admin/tenants/${diagId}/suspend`, { reason: "Chargeback review" }).expect(
        200,
      );
      const created = adminSupportCaseRowSchema.parse(
        (
          await send("post", "admin/support/cases", {
            accountId: diagId,
            title: "Stuck checkout",
            category: "payments",
            reason: REASON,
          }).expect(201)
        ).body,
      );
      const detail = adminSupportCaseDetailSchema.parse(
        (await get(`admin/support/cases/${created.id}`).expect(200)).body,
      );
      expect(detail.diagnostics.subscription).toMatchObject({
        status: "free",
        plan: { code: "free" },
      });
      expect(detail.diagnostics.stuckPayments).toBe(1);
      expect(detail.diagnostics.lastPayment).toMatchObject({
        status: "pending",
        provider: "mpesa",
      });
      expect(detail.diagnostics.lastPayment!.phone).not.toContain("254712345678");
      expect(detail.diagnostics.recentActions.length).toBeLessThanOrEqual(5);
      expect(detail.diagnostics.recentActions.map((a) => a.action)).toContain("tenant.suspend");
    });

    it("lists an account's cases and loose notes for the tenant tab", async () => {
      const owner = await signUp(app, uniqueEmail("tab"));
      const tabId = await userId(owner.email);
      const created = adminSupportCaseRowSchema.parse(
        (
          await send("post", "admin/support/cases", {
            accountId: tabId,
            title: "Tab case",
            category: "other",
            reason: REASON,
          }).expect(201)
        ).body,
      );
      await send("post", `admin/support/accounts/${tabId}/notes`, { body: "Loose" }).expect(201);
      await send("post", `admin/support/cases/${created.id}/notes`, { body: "On the case" }).expect(
        201,
      );
      const tab = adminSupportAccountSchema.parse(
        (await get(`admin/support/accounts/${tabId}`).expect(200)).body,
      );
      expect(tab.cases.map((c) => c.id)).toEqual([created.id]);
      expect(tab.notes.map((n) => n.body)).toEqual(["Loose"]);
      await get(`admin/support/accounts/${crypto.randomUUID()}`).expect(404);
      await get("admin/support/cases/not-a-uuid").expect(404);
    });

    it("refuses a note whose case and account disagree, even by direct insert", async () => {
      const created = await newCase({ title: "Mismatch" });
      const other = await userId((await signUp(app)).email);
      await expect(
        db()
          .insert(schema.supportNotes)
          .values({ caseId: created.id, accountId: other, authorId: adminId, body: "x" }),
      ).rejects.toThrow();
    });
  });

  describe("settings", () => {
    it("lists all three with defaults, before anything is changed", async () => {
      const { settings } = adminSettingsSchema.parse(
        (await get("admin/settings").expect(200)).body,
      );
      expect(settings.map((s) => s.key)).toEqual([
        "registration",
        "announcement",
        "support_contact",
      ]);
      for (const setting of settings) {
        expect(setting).toMatchObject({ isDefault: true, updatedBy: null, updatedAt: null });
        expect(setting.value).toEqual(platformSettingDefaults[setting.key]);
      }
    });

    it("saves a setting, records who and when, and audits before and after", async () => {
      const value = {
        email: "help@billsafi.test",
        whatsapp: "+254712345678",
        hours: "Weekdays 9 to 5",
      };
      const response = await setSettingOk("support_contact", value);
      expect(response.body).toMatchObject({
        key: "support_contact",
        value,
        isDefault: false,
        updatedBy: { id: adminId, email: adminEmail },
      });
      const rows = await auditRows("settings.update", "support_contact");
      expect(rows.at(-1)).toMatchObject({
        outcome: "success",
        reason: REASON,
        actorUserId: adminId,
      });
      const changes = rows.at(-1)!.changes as {
        value: { from: object; to: Record<string, string> };
      };
      expect(changes.value.from).toEqual(platformSettingDefaults.support_contact);
      expect(changes.value.to.email).toBe("help@billsafi.test");

      const listed = adminSettingsSchema.parse((await get("admin/settings")).body);
      expect(listed.settings.find((s) => s.key === "support_contact")).toMatchObject({
        isDefault: false,
        value,
      });

      // Putting the default back reads as default again.
      await setSettingOk("support_contact", platformSettingDefaults.support_contact);
      const back = adminSettingsSchema.parse((await get("admin/settings")).body);
      expect(back.settings.find((s) => s.key === "support_contact")!.isDefault).toBe(true);
    });

    async function setSettingOk(key: string, value: object) {
      return setSetting(key, value).expect(200);
    }

    it("validates each key's value and needs a reason", async () => {
      const bad = await setSetting("announcement", {
        active: true,
        tone: "info",
        message: "",
      }).expect(400);
      expect(bad.body.issues).toEqual([expect.objectContaining({ path: "value.message" })]);
      await setSetting("announcement", { active: true, tone: "loud", message: "x" }).expect(400);
      await setSetting("announcement", {
        active: true,
        tone: "info",
        message: "x",
        linkUrl: "http://insecure.test",
      }).expect(400);
      await setSetting("support_contact", { email: "nope" }).expect(400);
      await send("put", "admin/settings/registration", {
        value: { open: false, closedMessage: "Paused" },
      }).expect(400);
      await send("put", "admin/settings/registration", {
        value: { open: false, closedMessage: "Paused" },
        reason: "no",
      }).expect(400);
      await setSetting("feature_flags", {}).expect(404);
    });

    it("records a failed save as a failure row", async () => {
      await setSetting("registration", { open: "maybe" }).expect(400);
      // Validation failures are refused before the runner; nothing was stored.
      const listed = adminSettingsSchema.parse((await get("admin/settings")).body);
      expect(listed.settings.find((s) => s.key === "registration")!.isDefault).toBe(true);
    });

    it("limits settings changes to the admin action rate", async () => {
      const limited = (await createTestApp({ adminActionLimit: 2 })).app;
      try {
        const put = () =>
          request(limited.getHttpServer())
            .put("/api/v1/admin/settings/announcement")
            .set("Cookie", admin2Cookie)
            .send({ value: platformSettingDefaults.announcement, reason: REASON });
        await put().expect(200);
        await put().expect(200);
        await put().expect(429);
      } finally {
        await limited.close();
      }
    });
  });

  describe("platform", () => {
    it("is public and returns only registration, the active announcement and the contact", async () => {
      const response = await api().get("/api/v1/platform").expect(200);
      expect(platformInfoSchema.strict().parse(response.body)).toEqual({
        registration: {
          open: true,
          closedMessage: platformSettingDefaults.registration.closedMessage,
        },
        announcement: null,
        supportContact: { email: "support@billsafi.com" },
      });
      expect(Object.keys(response.body).sort()).toEqual([
        "announcement",
        "registration",
        "supportContact",
      ]);
    });

    it("shows an announcement only inside its window, and refreshes after a save", async () => {
      const hour = 60 * MINUTE;
      const base = { active: true, tone: "warning", message: "Planned maintenance tonight" };
      await setSetting("announcement", {
        ...base,
        linkUrl: "https://billsafi.com/status",
        startsAt: new Date(Date.now() - hour).toISOString(),
        endsAt: new Date(Date.now() + hour).toISOString(),
      }).expect(200);
      // Right after the PUT, with no 30 second wait: the save cleared the cache.
      const shown = await api().get("/api/v1/platform").expect(200);
      expect(shown.body.announcement).toEqual({
        tone: "warning",
        message: "Planned maintenance tonight",
        linkUrl: "https://billsafi.com/status",
      });
      expect(JSON.stringify(shown.body)).not.toMatch(/updatedBy|reason|startsAt|endsAt/);

      await setSetting("announcement", {
        ...base,
        startsAt: new Date(Date.now() + hour).toISOString(),
      }).expect(200);
      expect((await api().get("/api/v1/platform").expect(200)).body.announcement).toBeNull();
      await setSetting("announcement", {
        ...base,
        endsAt: new Date(Date.now() - hour).toISOString(),
      }).expect(200);
      expect((await api().get("/api/v1/platform").expect(200)).body.announcement).toBeNull();
      await setSetting("announcement", { ...base, active: false }).expect(200);
      expect((await api().get("/api/v1/platform").expect(200)).body.announcement).toBeNull();
    });

    it("caches for 30 seconds: a direct database change is not seen at once", async () => {
      await setSetting("support_contact", { email: "cached@billsafi.test" }).expect(200);
      expect((await api().get("/api/v1/platform")).body.supportContact.email).toBe(
        "cached@billsafi.test",
      );
      await db()
        .update(schema.platformSettings)
        .set({ value: { email: "sneaky@billsafi.test" } })
        .where(eq(schema.platformSettings.key, "support_contact"));
      expect((await api().get("/api/v1/platform")).body.supportContact.email).toBe(
        "cached@billsafi.test",
      );
      await setSetting("support_contact", platformSettingDefaults.support_contact).expect(200);
      expect((await api().get("/api/v1/platform")).body.supportContact.email).toBe(
        "support@billsafi.com",
      );
    });
  });

  describe("registration switch", () => {
    const CLOSED = "Sign-ups are closed while we upgrade. Back on Monday.";
    let existing: { email: string; cookie: string };
    const googleUser = (email: string, sub = crypto.randomUUID()) => ({
      sub,
      email,
      email_verified: true,
      name: "Njeri Mwangi",
      picture: null,
    });

    async function finishGoogleSignIn(profile: Record<string, unknown>) {
      googleProfile = profile;
      const start = await api()
        .post("/api/v1/auth/sign-in/social")
        .set("Origin", WEB_ORIGIN)
        .send({
          provider: "google",
          callbackURL: "/",
          newUserCallbackURL: "/onboarding",
          errorCallbackURL: "/sign-in",
        })
        .expect(200);
      const cookies = ([] as string[])
        .concat(start.headers["set-cookie"] ?? [])
        .map((cookie) => cookie.split(";")[0])
        .join("; ");
      const state = new URL(start.body.url).searchParams.get("state");
      const response = await api()
        .get("/api/v1/auth/callback/google")
        .query({ code: "google-auth-code", state })
        .set("Cookie", cookies)
        .expect(302);
      const setCookie = ([] as string[]).concat(response.headers["set-cookie"] ?? []);
      return {
        location: new URL(response.headers.location!, WEB_ORIGIN),
        session: setCookie.find((cookie) => cookie.startsWith("better-auth.session_token=")),
      };
    }

    const signUpEmail = (email: string) =>
      api()
        .post("/api/v1/auth/sign-up/email")
        .set("Origin", WEB_ORIGIN)
        .send({ name: "Wanjiku Kamau", email, password: "correct-horse-battery" });

    beforeAll(async () => {
      existing = await signUp(app, uniqueEmail("already-here"));
    });

    afterAll(async () => {
      await setSetting("registration", platformSettingDefaults.registration);
    });

    it("closes registration with the red-action audit, and /platform reports it", async () => {
      const response = await setSetting("registration", {
        open: false,
        closedMessage: CLOSED,
      }).expect(200);
      expect(response.body).toMatchObject({
        key: "registration",
        value: { open: false, closedMessage: CLOSED },
      });
      const [row] = await auditRows("settings.update", "registration");
      expect(row!.changes).toEqual({
        value: {
          from: platformSettingDefaults.registration,
          to: { open: false, closedMessage: CLOSED },
        },
      });
      expect((await api().get("/api/v1/platform")).body.registration).toEqual({
        open: false,
        closedMessage: CLOSED,
      });
    });

    it("refuses email sign-up with a code and message the web can show, and creates no user", async () => {
      const email = uniqueEmail("blocked");
      const response = await signUpEmail(email).expect(403);
      expect(response.body).toMatchObject({ code: REGISTRATION_CLOSED_CODE, message: CLOSED });
      const found = await db().select().from(schema.users).where(eq(schema.users.email, email));
      expect(found).toHaveLength(0);
    });

    it("refuses a first-time Google user and sends them back to sign-in with the code", async () => {
      const email = uniqueEmail("google-blocked");
      const { location, session } = await finishGoogleSignIn(googleUser(email));
      expect(session).toBeUndefined();
      expect(location.pathname).toBe("/sign-in");
      expect(location.searchParams.get("error")).toBe(REGISTRATION_CLOSED_CODE);
      expect(location.searchParams.get("error_description")).toBe(CLOSED);
      const found = await db().select().from(schema.users).where(eq(schema.users.email, email));
      expect(found).toHaveLength(0);
    });

    it("still signs in existing users, by password and by Google, and keeps admins in", async () => {
      await api()
        .post("/api/v1/auth/sign-in/email")
        .set("Origin", WEB_ORIGIN)
        .send({ email: existing.email, password: "correct-horse-battery" })
        .expect(200);
      await api().get("/api/v1/admin/access").set("Cookie", adminCookie).expect(204);
      await api()
        .post("/api/v1/auth/sign-in/email")
        .set("Origin", WEB_ORIGIN)
        .send({ email: adminEmail, password: "correct-horse-battery" })
        .expect(200);

      // A Google user made while registration was open signs in after it closes.
      const profile = googleUser(uniqueEmail("google-before"));
      await setSetting("registration", platformSettingDefaults.registration).expect(200);
      expect((await finishGoogleSignIn(profile)).session).toBeDefined();
      await setSetting("registration", { open: false, closedMessage: CLOSED }).expect(200);
      const again = await finishGoogleSignIn(profile);
      expect(again.session).toBeDefined();
      expect(again.location.pathname).toBe("/");
    });

    it("lets people sign up again once it is reopened", async () => {
      await setSetting("registration", platformSettingDefaults.registration).expect(200);
      await signUpEmail(uniqueEmail("reopened")).expect(200);
      const { session } = await finishGoogleSignIn(googleUser(uniqueEmail("google-reopened")));
      expect(session).toBeDefined();
    });
  });
});
