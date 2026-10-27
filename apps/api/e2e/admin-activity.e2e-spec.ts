import { execFileSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import {
  adminAnalyticsSchema,
  adminFailedSignInsPageSchema,
  adminFailuresPageSchema,
  adminHealthSchema,
  adminOverviewSchema,
  adminTenantActivityPageSchema,
  adminTrendsSchema,
} from "@billsafi/contracts";
import { createDatabase, type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import request from "supertest";
import { ActivityRecorder } from "../src/activity/activity-recorder.js";
import { PruneService } from "../src/activity/prune.service.js";
import { BackupsHealthProvider } from "../src/admin/health/backups-health.provider.js";
import { BillingJobsHealthProvider } from "../src/admin/health/billing-jobs-health.provider.js";
import { PdfEmailHealthProvider } from "../src/admin/health/pdf-email-health.provider.js";
import { DATABASE } from "../src/database/database.module.js";
import {
  createBusiness,
  createTestApp,
  dropThrowawayDatabase,
  signUp,
  uniqueEmail,
  WEB_ORIGIN,
} from "./support/app.js";

/**
 * Super admin phase 5 (what is recorded and where it shows). Health, the Overview counts
 * and the pruning-sensitive tables are global, so this file uses a database of its own.
 */
const ORIGINAL_URL = process.env.DATABASE_URL!;
const DB_NAME = `billsafi_activity_${crypto.randomUUID().replace(/-/g, "")}`;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("admin activity", () => {
  let app: INestApplication;
  let adminCookie: string;
  let userCookie: string;
  let adminConnection: DatabaseConnection;
  const api = () => request(app.getHttpServer());
  const connection = () => app.get<DatabaseConnection>(DATABASE);
  const db = () => connection().db;
  const get = (path: string) => api().get(`/api/v1/${path}`).set("Cookie", adminCookie);

  async function userId(email: string) {
    const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email));
    return user!.id;
  }

  async function clearRecords() {
    for (const table of [
      "product_events",
      "operation_failures",
      "job_runs",
      "backup_runs",
      "failed_sign_ins",
    ]) {
      await db().execute(sql.raw(`delete from ${table}`));
    }
  }

  const failure = (
    kind: "pdf" | "email" | "job",
    createdAt: Date,
    accountId: string | null = null,
  ) =>
    db()
      .insert(schema.operationFailures)
      .values({
        kind,
        operation:
          kind === "pdf"
            ? "invoice_pdf"
            : kind === "email"
              ? "password_reset_email"
              : "billing_sweep",
        accountId,
        errorClass: "Error",
        message: "Something broke",
        createdAt,
      });

  beforeAll(async () => {
    adminConnection = createDatabase(ORIGINAL_URL);
    await adminConnection.pool.query(`create database "${DB_NAME}"`);
    const url = new URL(ORIGINAL_URL);
    url.pathname = `/${DB_NAME}`;
    process.env.DATABASE_URL = url.toString();
    try {
      execFileSync("pnpm", ["--filter", "@billsafi/db", "db:migrate"], {
        env: { ...process.env, DATABASE_URL: url.toString() },
        stdio: "pipe",
      });
    } catch (error) {
      const failed = error as { stdout?: Buffer; stderr?: Buffer };
      throw new Error(
        `Migrating the throwaway database failed:\n${failed.stderr?.toString() ?? ""}${failed.stdout?.toString() ?? ""}`,
      );
    }
    ({ app } = await createTestApp({ adminActionLimit: 1000 }));
    const admin = await signUp(app, uniqueEmail("activity-admin"));
    adminCookie = admin.cookie;
    await db()
      .update(schema.users)
      .set({ role: "admin" })
      .where(eq(schema.users.id, await userId(admin.email)));
    userCookie = (await signUp(app)).cookie;
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      process.env.DATABASE_URL = ORIGINAL_URL;
      try {
        if (adminConnection) await dropThrowawayDatabase(adminConnection, DB_NAME);
      } finally {
        await adminConnection?.pool.end();
      }
    }
  });

  describe("access", () => {
    it.each([
      "health/failures",
      "security/failed-sign-ins",
      `tenants/${crypto.randomUUID()}/activity`,
    ])("answers 404 on %s to a signed-out visitor and a non-admin", async (route) => {
      await api().get(`/api/v1/admin/${route}`).expect(404);
      await api().get(`/api/v1/admin/${route}`).set("Cookie", userCookie).expect(404);
    });
  });

  describe("Health providers, with a fixed clock", () => {
    const now = new Date("2031-03-17T09:00:00.000Z");
    const ago = (ms: number) => new Date(now.getTime() - ms);

    describe("billing jobs", () => {
      const steps = ["billing_sweep", "renewal_reminders", "idempotency_prune"] as const;
      const provider = (enabled = true) => new BillingJobsHealthProvider(connection(), enabled);
      const run = (job: string, finishedAt: Date, status: "succeeded" | "failed" = "succeeded") =>
        db().insert(schema.jobRuns).values({ job, startedAt: finishedAt, finishedAt, status });
      const allRan = async (age: number) => {
        for (const job of steps) await run(job, ago(age));
      };

      beforeEach(clearRecords);

      it("is unknown, and says why, when jobs are switched off", async () => {
        await allRan(5 * MINUTE);
        const reading = await provider(false).check(now);
        expect(reading.status).toBe("unknown");
        expect(reading.detail).toContain("BILLING_JOBS=off");
      });

      it("is unknown before any run", async () => {
        expect((await provider().check(now)).status).toBe("unknown");
      });

      it("is ok up to 15 minutes", async () => {
        await allRan(15 * MINUTE);
        expect((await provider().check(now)).status).toBe("ok");
      });

      it("warns after 15 minutes and fails after an hour", async () => {
        await allRan(5 * MINUTE);
        await run("renewal_reminders", ago(16 * MINUTE));
        // The newest run of each step counts, so make the reminders the late one.
        await db().delete(schema.jobRuns).where(eq(schema.jobRuns.job, "renewal_reminders"));
        await run("renewal_reminders", ago(16 * MINUTE));
        expect((await provider().check(now)).status).toBe("warning");

        await db().delete(schema.jobRuns).where(eq(schema.jobRuns.job, "renewal_reminders"));
        await run("renewal_reminders", ago(61 * MINUTE));
        const late = await provider().check(now);
        expect(late.status).toBe("failing");
        expect(late.detail).toContain("renewal reminders");
      });

      it("fails when the last run of a step failed, even a recent one", async () => {
        await allRan(10 * MINUTE);
        await run("billing_sweep", ago(MINUTE), "failed");
        const reading = await provider().check(now);
        expect(reading.status).toBe("failing");
        expect(reading.detail).toContain("failed");
      });

      it("recovers once a later run succeeds", async () => {
        await allRan(10 * MINUTE);
        await run("billing_sweep", ago(3 * MINUTE), "failed");
        await run("billing_sweep", ago(MINUTE));
        expect((await provider().check(now)).status).toBe("ok");
      });

      it("fails when a step has never run while others have", async () => {
        await run("billing_sweep", ago(MINUTE));
        expect((await provider().check(now)).status).toBe("failing");
      });
    });

    describe("PDF and email failures", () => {
      const provider = () => new PdfEmailHealthProvider(connection());
      beforeEach(clearRecords);

      it("is ok at 0", async () => {
        expect(await provider().check(now)).toMatchObject({ status: "ok", value: "0 in 24h" });
      });

      it("warns for 1 to 4 and fails from 5, counting only pdf and email in 24 hours", async () => {
        await failure("pdf", ago(HOUR));
        expect((await provider().check(now)).status).toBe("warning");
        for (let i = 0; i < 3; i++) await failure("email", ago(2 * HOUR));
        const four = await provider().check(now);
        expect(four).toMatchObject({ status: "warning", data: { pdf: 1, email: 3 } });
        await failure("pdf", ago(3 * HOUR));
        expect((await provider().check(now)).status).toBe("failing");
      });

      it("ignores old failures and job failures", async () => {
        for (let i = 0; i < 6; i++) await failure("pdf", ago(25 * HOUR));
        for (let i = 0; i < 6; i++) await failure("job", ago(HOUR));
        expect((await provider().check(now)).status).toBe("ok");
      });
    });

    describe("backups", () => {
      const provider = () => new BackupsHealthProvider(connection());
      const backup = (age: number, status: "succeeded" | "failed" = "succeeded") =>
        db()
          .insert(schema.backupRuns)
          .values({
            startedAt: ago(age),
            finishedAt: ago(age),
            status,
            sizeBytes: status === "succeeded" ? 123_456 : null,
            error: status === "failed" ? "Backup failed with exit code 1" : null,
          });
      beforeEach(clearRecords);

      it("is unknown with no runs", async () => {
        expect((await provider().check(now)).status).toBe("unknown");
      });

      it("is ok under 26 hours", async () => {
        await backup(25 * HOUR + 59 * MINUTE);
        expect(await provider().check(now)).toMatchObject({
          status: "ok",
          data: { lastGoodAgeHours: 25, lastGoodSizeBytes: 123_456 },
        });
      });

      it("warns from 26 to under 50 hours and fails beyond", async () => {
        await backup(26 * HOUR);
        expect((await provider().check(now)).status).toBe("warning");
        await clearRecords();
        await backup(49 * HOUR + 59 * MINUTE);
        expect((await provider().check(now)).status).toBe("warning");
        await clearRecords();
        await backup(50 * HOUR);
        expect((await provider().check(now)).status).toBe("failing");
      });

      it("fails when the last run failed, and names the last good backup", async () => {
        await backup(30 * HOUR);
        await backup(HOUR, "failed");
        const reading = await provider().check(now);
        expect(reading.status).toBe("failing");
        expect(reading.detail).toContain("30 hours");
      });

      it("is ok again after a good run follows a failed one", async () => {
        await backup(3 * HOUR, "failed");
        await backup(HOUR);
        expect((await provider().check(now)).status).toBe("ok");
      });
    });
  });

  describe("GET /admin/health", () => {
    beforeEach(clearRecords);

    it("returns the six indicators with the new three filled from what is recorded", async () => {
      await failure("pdf", new Date());
      const health = adminHealthSchema.parse((await get("admin/health").expect(200)).body);
      const byKey = Object.fromEntries(health.indicators.map((i) => [i.key, i]));
      expect(health.indicators.map((i) => i.key)).toEqual([
        "database",
        "migrations",
        "mpesa",
        "billing_jobs",
        "pdf_email",
        "backups",
      ]);
      // BILLING_JOBS is off in tests.
      expect(byKey.billing_jobs).toMatchObject({ status: "unknown" });
      expect(byKey.billing_jobs!.detail).toContain("BILLING_JOBS=off");
      expect(byKey.pdf_email).toMatchObject({ status: "warning", data: { pdf: 1, email: 0 } });
      expect(byKey.backups).toMatchObject({ status: "unknown" });
    });
  });

  describe("GET /admin/health/failures", () => {
    beforeEach(clearRecords);

    it("lists newest first, filters by kind and counts the last 24 hours", async () => {
      const owner = await userId((await signUp(app)).email);
      await failure("pdf", new Date(Date.now() - 3 * HOUR), owner);
      await failure("email", new Date(Date.now() - 2 * HOUR));
      await failure("job", new Date(Date.now() - HOUR));
      await failure("pdf", new Date(Date.now() - 30 * HOUR));

      const all = adminFailuresPageSchema.parse(
        (await get("admin/health/failures").expect(200)).body,
      );
      expect(all.total).toBe(4);
      expect(all.items.map((item) => item.kind)).toEqual(["job", "email", "pdf", "pdf"]);
      expect(all.items[2]!.account).toMatchObject({ id: owner });
      expect(all.items[1]!.account).toBeNull();
      expect(all.last24h).toEqual({ pdf: 1, email: 1, job: 1 });

      const pdf = adminFailuresPageSchema.parse(
        (await get("admin/health/failures?kind=pdf").expect(200)).body,
      );
      expect(pdf.total).toBe(2);
      expect(pdf.last24h).toEqual({ pdf: 1, email: 1, job: 1 });
      await get("admin/health/failures?kind=mpesa").expect(400);
    });

    it("pages by 25", async () => {
      for (let i = 0; i < 27; i++) await failure("pdf", new Date(Date.now() - i * MINUTE));
      const page2 = adminFailuresPageSchema.parse(
        (await get("admin/health/failures?page=2").expect(200)).body,
      );
      expect(page2).toMatchObject({ page: 2, pageSize: 25, total: 27 });
      expect(page2.items).toHaveLength(2);
    });
  });

  describe("Overview, trends and analytics", () => {
    beforeEach(async () => {
      await clearRecords();
      await db().execute(sql`delete from subscription_payments where provider = 'mpesa'`);
    });

    it("counts failed operations by kind, keeps M-Pesa fields and fills the attention items", async () => {
      const owner = await userId((await signUp(app)).email);
      await db().insert(schema.subscriptionPayments).values({
        userId: owner,
        purpose: "pro_month",
        amount: "500.00",
        status: "failed",
        provider: "mpesa",
        phone: "254712345678",
      });
      await failure("pdf", new Date());
      await failure("pdf", new Date());
      await failure("email", new Date());
      await failure("job", new Date());
      await failure("pdf", new Date(Date.now() - 40 * 24 * 60 * 60 * 1000));

      const overview = adminOverviewSchema.parse((await get("admin/overview").expect(200)).body);
      expect(overview.failedOperations.current).toEqual({
        total: 5,
        mpesa: 1,
        pdf: 2,
        email: 1,
        jobs: 1,
      });
      // 40 days ago is in the previous 30 day period.
      expect(overview.failedOperations.previous).toMatchObject({ pdf: 1, total: 1 });
      expect(overview.mpesa.current.failed).toBe(1);
      expect(overview.attention.failedOperationsToday).toBe(5);
    });

    it("flags an email with 10 failed sign-ins inside an hour, and no other", async () => {
      // Rows sit inside one earlier clock hour so the test can't straddle an hour boundary.
      const now = Date.now();
      const hourStart = Math.floor(now / HOUR) * HOUR - HOUR;
      const row = (email: string, at: number) => ({
        email,
        method: "password" as const,
        reason: "wrong_password" as const,
        createdAt: new Date(at),
      });
      await db()
        .insert(schema.failedSignIns)
        .values([
          ...Array.from({ length: 10 }, (_, i) =>
            row("hammered@example.test", hourStart + i * MINUTE),
          ),
          // Nine in an hour is not enough.
          ...Array.from({ length: 9 }, (_, i) =>
            row("almost@example.test", hourStart + i * MINUTE),
          ),
          // Ten spread over five hours is not repeated in any one hour.
          ...Array.from({ length: 10 }, (_, i) =>
            row("slow@example.test", hourStart - i * 30 * MINUTE),
          ),
          // Ten in an hour, but over a day ago.
          ...Array.from({ length: 10 }, (_, i) =>
            row("old@example.test", now - 30 * HOUR - i * MINUTE),
          ),
        ]);
      // Another range, because the Overview is cached for a minute per range.
      const overview = adminOverviewSchema.parse(
        (await get("admin/overview?range=7d").expect(200)).body,
      );
      expect(overview.attention.repeatedFailedSignIns).toBe(1);
    });

    it("adds PDF downloads by source and link opens to the trend points", async () => {
      const owner = await userId((await signUp(app)).email);
      await db()
        .insert(schema.productEvents)
        .values([
          { name: "pdf_downloaded", accountId: owner, props: { source: "app" } },
          { name: "pdf_downloaded", accountId: owner, props: { source: "app" } },
          { name: "pdf_downloaded", accountId: owner, props: { source: "public_link" } },
          { name: "link_opened", accountId: owner },
          { name: "link_opened", accountId: owner, dedupeKey: "x:1" },
        ]);
      const trends = adminTrendsSchema.parse((await get("admin/overview/trends").expect(200)).body);
      const last = trends.points.at(-1)!;
      expect(last.pdfDownloads).toEqual({ app: 2, publicLink: 1 });
      expect(last.linkOpens).toBe(2);
      expect(trends.points[0]!.pdfDownloads).toEqual({ app: 0, publicLink: 0 });
    });

    it("builds the generator funnel from distinct visitors and adds two adoption rows", async () => {
      const ids = Array.from({ length: 4 }, () => crypto.randomUUID());
      const event = (name: string, anonymousId: string) => ({ name, anonymousId });
      const { cookie, email } = await signUp(app);
      await createBusiness(app, cookie);
      const owner = await userId(email);
      await db()
        .insert(schema.productEvents)
        .values([
          ...ids.map((id) => event("generator_started", id)),
          event("generator_started", ids[0]!),
          event("generator_download_clicked", ids[0]!),
          event("generator_download_clicked", ids[1]!),
          event("generator_signup_clicked", ids[0]!),
          {
            name: "guest_invoice_imported",
            anonymousId: ids[0]!,
            accountId: owner,
            props: { usedExistingBusiness: false },
          },
          { name: "pdf_downloaded", accountId: owner, props: { source: "app" } },
          { name: "link_opened", accountId: owner },
        ]);
      const analytics = adminAnalyticsSchema.parse((await get("admin/analytics").expect(200)).body);
      expect(analytics.generatorFunnel.steps).toEqual([
        { key: "started", count: 4, share: 1 },
        { key: "download_clicked", count: 2, share: 0.5 },
        { key: "signup_clicked", count: 1, share: 0.25 },
        { key: "imported", count: 1, share: 0.25 },
      ]);
      const items = Object.fromEntries(analytics.featureAdoption.items.map((i) => [i.key, i]));
      expect(items.pdfDownloaded!.count).toBe(1);
      expect(items.shareLinkOpened!.count).toBe(1);
      expect(items.pdfDownloaded!.base).toBe(analytics.featureAdoption.base);
    });
  });

  describe("GET /admin/security/failed-sign-ins", () => {
    beforeEach(clearRecords);

    const seed = async () => {
      const now = Date.now();
      await db()
        .insert(schema.failedSignIns)
        .values([
          {
            email: "a@example.test",
            method: "password",
            reason: "wrong_password",
            ipMasked: "203.0.113.0/24",
            createdAt: new Date(now - HOUR),
          },
          {
            email: "a@example.test",
            method: "password",
            reason: "wrong_password",
            ipMasked: "203.0.113.0/24",
            createdAt: new Date(now - 2 * HOUR),
          },
          {
            email: "b@example.test",
            method: "password",
            reason: "unknown_email",
            ipMasked: "198.51.100.0/24",
            createdAt: new Date(now - 3 * HOUR),
          },
          {
            email: null,
            method: "google",
            reason: "banned",
            ipMasked: null,
            createdAt: new Date(now - 4 * HOUR),
          },
          {
            email: "a@example.test",
            method: "password",
            reason: "wrong_password",
            ipMasked: "203.0.113.0/24",
            createdAt: new Date(now - 3 * 24 * HOUR),
          },
          {
            email: "c@example.test",
            method: "google",
            reason: "registration_closed",
            ipMasked: null,
            createdAt: new Date(now - 20 * 24 * HOUR),
          },
        ]);
    };

    it("lists newest first within the range with the summary", async () => {
      await seed();
      const page = adminFailedSignInsPageSchema.parse(
        (await get("admin/security/failed-sign-ins").expect(200)).body,
      );
      // The default range is 7 days: the 20 day old row is outside it.
      expect(page.total).toBe(5);
      expect(page.items[0]).toMatchObject({ email: "a@example.test", reason: "wrong_password" });
      expect(page.summary.last24h).toBe(4);
      expect(page.summary.last7d).toBe(5);
      expect(page.summary.topEmails[0]).toEqual({ email: "a@example.test", count: 2 });
      expect(page.summary.topIps[0]).toEqual({ ipMasked: "203.0.113.0/24", count: 2 });
      expect(JSON.stringify(page)).not.toMatch(/password":/);
    });

    it("filters by email, method, reason and range, and the summary ignores the filters", async () => {
      await seed();
      const filtered = async (query: string) =>
        adminFailedSignInsPageSchema.parse(
          (await get(`admin/security/failed-sign-ins?${query}`).expect(200)).body,
        );
      expect((await filtered("email=B@EXAMPLE")).total).toBe(1);
      expect((await filtered("method=google")).total).toBe(1);
      expect((await filtered("reason=wrong_password")).total).toBe(3);
      expect((await filtered("range=30d")).total).toBe(6);
      const none = await filtered("email=nobody");
      expect(none.total).toBe(0);
      expect(none.summary.last24h).toBe(4);
      await get("admin/security/failed-sign-ins?method=sms").expect(400);
    });

    it("pages by 25", async () => {
      const now = Date.now();
      await db()
        .insert(schema.failedSignIns)
        .values(
          Array.from({ length: 30 }, (_, i) => ({
            email: "bulk@example.test",
            method: "password" as const,
            reason: "wrong_password" as const,
            createdAt: new Date(now - i * MINUTE),
          })),
        );
      const page2 = adminFailedSignInsPageSchema.parse(
        (await get("admin/security/failed-sign-ins?page=2").expect(200)).body,
      );
      expect(page2).toMatchObject({ page: 2, pageSize: 25, total: 30 });
      expect(page2.items).toHaveLength(5);
    });
  });

  describe("GET /admin/tenants/:id/activity", () => {
    beforeEach(clearRecords);

    it("merges that account's events and failures, newest first, and no one else's", async () => {
      const owner = await userId((await signUp(app)).email);
      const other = await userId((await signUp(app)).email);
      const now = Date.now();
      await db()
        .insert(schema.productEvents)
        .values([
          {
            name: "pdf_downloaded",
            accountId: owner,
            props: { source: "app" },
            createdAt: new Date(now - 3 * HOUR),
          },
          { name: "link_opened", accountId: owner, createdAt: new Date(now - HOUR) },
          { name: "link_opened", accountId: other },
        ]);
      await failure("email", new Date(now - 2 * HOUR), owner);
      await failure("pdf", new Date(), other);

      const page = adminTenantActivityPageSchema.parse(
        (await get(`admin/tenants/${owner}/activity`).expect(200)).body,
      );
      expect(page.total).toBe(3);
      expect(page.items.map((item) => item.name)).toEqual([
        "link_opened",
        "email",
        "pdf_downloaded",
      ]);
      expect(page.items[1]).toMatchObject({
        type: "failure",
        summary: "Password reset email failed to send",
        detail: "Something broke",
      });
      expect(page.items[2]!.summary).toBe("Downloaded an invoice PDF");
      await get(`admin/tenants/${crypto.randomUUID()}/activity`).expect(404);
      await get("admin/tenants/not-a-uuid/activity").expect(404);
    });
  });

  describe("limits on recording", () => {
    beforeEach(clearRecords);

    const attempt = (email: string, ip: string) =>
      api()
        .post("/api/v1/auth/sign-in/email")
        .set("Origin", WEB_ORIGIN)
        .set("X-Forwarded-For", ip)
        .send({ email, password: "not-the-password" });
    const count = async () => {
      await app.get(ActivityRecorder).flush();
      const [row] = await db()
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.failedSignIns);
      return row!.n;
    };

    it("skips a sign-in row when the same masked IP already has 20 in the last minute", async () => {
      const { email } = await signUp(app);
      await db()
        .insert(schema.failedSignIns)
        .values(
          Array.from({ length: 20 }, () => ({
            email: "flood@example.test",
            method: "password" as const,
            reason: "wrong_password" as const,
            ipMasked: "203.0.113.0/24",
          })),
        );
      await attempt(email, "203.0.113.9").expect(401);
      expect(await count()).toBe(20);
      // Another network is not throttled.
      await attempt(email, "198.51.100.9").expect(401);
      expect(await count()).toBe(21);
    });

    it("stops at 5,000 rows a day and keeps answering sign-ins", async () => {
      const { email } = await signUp(app);
      await db().execute(sql`
        insert into failed_sign_ins (email, method, reason, ip_masked)
        select 'bulk-' || (g % 500) || '@example.test', 'password', 'other', '10.' || (g % 250) || '.0.0/24'
        from generate_series(1, 5000) g
      `);
      await attempt(email, "203.0.113.9").expect(401);
      expect(await count()).toBe(5000);
    });

    it("stores no query text, parameters or values from a database error", async () => {
      const secret = "secret-value-123";
      let error: unknown;
      try {
        await db().execute(sql`select ${secret}::uuid`);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeDefined();
      app.get(ActivityRecorder).failure("pdf", "invoice_pdf", error);
      app.get(ActivityRecorder).failure("job", "billing_sweep", new Error(`boom ${secret}`));
      await app.get(ActivityRecorder).flush();
      const rows = await db().select().from(schema.operationFailures);
      expect(rows).toHaveLength(2);
      const stored = JSON.stringify(rows);
      expect(stored).not.toContain(secret);
      expect(stored).not.toMatch(/select|params/i);
      expect(rows.find((row) => row.kind === "job")).toMatchObject({
        errorClass: "Error",
        message: "The payment check job failed. The API log has the error.",
      });
    });

    it("prunes a backlog in batches", async () => {
      await db().execute(sql`
        insert into product_events (name, created_at)
        select 'link_opened', now() - interval '400 days' from generate_series(1, 5500)
      `);
      await db().execute(sql`
        insert into product_events (name, created_at) values ('link_opened', now())
      `);
      const counts = await app.get(PruneService).prune();
      expect(counts.productEvents).toBe(5500);
      const [left] = await db()
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.productEvents);
      expect(left!.n).toBe(1);
    });
  });
});
