import type { INestApplication } from "@nestjs/common";
import { type DatabaseConnection, and, eq, schema, sql } from "@billsafi/db";
import { nairobiDate } from "@billsafi/domain";
import request from "supertest";
import { ActivityRecorder } from "../src/activity/activity-recorder.js";
import {
  EVENT_INTAKE_GLOBAL_LIMITER,
  EVENT_INTAKE_LIMITER,
} from "../src/activity/events.controller.js";
import { MaintenanceJobs } from "../src/activity/maintenance.jobs.js";
import { SlidingWindowLimiter } from "../src/admin/shared/rate-limit.guard.js";
import { BillingJobs } from "../src/billing/billing.jobs.js";
import { BillingService } from "../src/billing/billing.service.js";
import { DATABASE } from "../src/database/database.module.js";
import { PdfService } from "../src/invoices/pdf.service.js";
import { MAILER } from "../src/mail/mail.module.js";
import { type Mailer, RecordingMailer } from "../src/mail/mailer.js";
import {
  createBusiness,
  createClient,
  createTestApp,
  signUp,
  uniqueEmail,
  WEB_ORIGIN,
} from "./support/app.js";

const today = nairobiDate(new Date());
const anonymousId = () => crypto.randomUUID();

/** A connection whose every insert fails, to prove recording never breaks the product. */
const brokenConnection = {
  db: {
    insert() {
      throw new Error("recording is down");
    },
  },
} as unknown as DatabaseConnection;

class FailingMailer implements Mailer {
  async send(): Promise<void> {
    throw new Error("SMTP refused alice@example.test with token abcdefghijklmnopqrstuvwxyz0123");
  }
}

describe("activity recording", () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());
  const db = () => app.get<DatabaseConnection>(DATABASE).db;
  const recorder = () => app.get(ActivityRecorder);

  beforeAll(async () => {
    ({ app } = await createTestApp({
      configure: (builder) =>
        builder
          .overrideProvider(EVENT_INTAKE_LIMITER)
          .useValue(new SlidingWindowLimiter(10, 60_000))
          .overrideProvider(MAILER)
          .useFactory({
            factory: (activity: ActivityRecorder) =>
              new RecordingMailer(new FailingMailer(), activity),
            inject: [ActivityRecorder],
          }),
    }));
  });

  afterAll(async () => {
    await recorder().flush();
    await app.close();
  });

  async function readyInvoice() {
    const { cookie, email } = await signUp(app);
    const businessId = await createBusiness(app, cookie);
    const clientId = await createClient(app, cookie, businessId);
    const base = `/api/v1/businesses/${businessId}/invoices`;
    const draft = await api()
      .post(base)
      .set("Cookie", cookie)
      .send({
        clientId,
        issueDate: today,
        dueDate: today,
        items: [{ description: "Website build", quantity: "1", unitPrice: "50000" }],
      })
      .expect(201);
    const path = `${base}/${draft.body.id}`;
    await api().post(`${path}/ready`).set("Cookie", cookie).expect(200);
    const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email));
    return { cookie, email, path, invoiceId: draft.body.id as string, userId: user!.id };
  }

  async function events(name: string, accountId: string) {
    await recorder().flush();
    return db()
      .select()
      .from(schema.productEvents)
      .where(
        and(eq(schema.productEvents.name, name), eq(schema.productEvents.accountId, accountId)),
      );
  }

  async function failuresFor(accountId: string) {
    await recorder().flush();
    return db()
      .select()
      .from(schema.operationFailures)
      .where(eq(schema.operationFailures.accountId, accountId));
  }

  describe("PDF downloads and link opens", () => {
    it("records one pdf_downloaded per app download", async () => {
      const { cookie, path, invoiceId, userId } = await readyInvoice();
      await api().get(`${path}/pdf`).set("Cookie", cookie).expect(200);
      const rows = await events("pdf_downloaded", userId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ invoiceId, props: { source: "app" } });
    });

    it("records a public link PDF against the invoice owner, and one open a day", async () => {
      const { cookie, path, invoiceId, userId } = await readyInvoice();
      const link = await api().post(`${path}/link`).set("Cookie", cookie).expect(201);
      const token = link.body.token as string;

      await api().get(`/api/v1/public/invoices/${token}/pdf`).expect(200);
      const pdfs = await events("pdf_downloaded", userId);
      expect(pdfs).toHaveLength(1);
      expect(pdfs[0]).toMatchObject({ invoiceId, props: { source: "public_link" } });

      for (let i = 0; i < 3; i++) await api().get(`/api/v1/public/invoices/${token}`).expect(200);
      expect(await events("link_opened", userId)).toHaveLength(1);

      // The next Nairobi day counts again; the same day does not.
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      recorder().linkOpened({ id: link.body.id, accountId: userId, invoiceId }, tomorrow);
      recorder().linkOpened({ id: link.body.id, accountId: userId, invoiceId }, tomorrow);
      expect(await events("link_opened", userId)).toHaveLength(2);
    });

    it("records nothing for a dead link", async () => {
      const before = await db()
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.productEvents);
      await api()
        .get(`/api/v1/public/invoices/${"a".repeat(43)}`)
        .expect(404);
      await recorder().flush();
      const after = await db()
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.productEvents);
      expect(after[0]!.n).toBe(before[0]!.n);
    });
  });

  describe("failures", () => {
    it("records a failed render as one pdf failure and still answers with the error", async () => {
      const { cookie, path, userId } = await readyInvoice();
      const pdf = app.get(PdfService);
      const render = vi.spyOn(pdf, "render").mockRejectedValueOnce(new Error("render exploded"));
      await api().get(`${path}/pdf`).set("Cookie", cookie).expect(500);
      render.mockRestore();
      const rows = await failuresFor(userId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "pdf", operation: "invoice_pdf" });
      expect(await events("pdf_downloaded", userId)).toHaveLength(0);
    });

    it("records a failed password reset email without addresses or tokens", async () => {
      const { email } = await signUp(app);
      const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email));
      const userId = user!.id;
      await api()
        .post("/api/v1/auth/request-password-reset")
        .set("Origin", WEB_ORIGIN)
        .send({ email, redirectTo: `${WEB_ORIGIN}/reset-password` });
      await vi.waitFor(async () => {
        const rows = await failuresFor(userId);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ kind: "email", operation: "password_reset_email" });
        expect(rows[0]!.message).toBe("SMTP refused [email] with token [token]");
      });
    });
  });

  describe("job runs", () => {
    it("records one run per billing step and a failure row for a failing step", async () => {
      const failuresNow = async () => {
        await recorder().flush();
        return (
          await db()
            .select()
            .from(schema.operationFailures)
            .where(eq(schema.operationFailures.operation, "billing_sweep"))
        ).length;
      };
      const failuresBefore = await failuresNow();
      const runsNow = async () => {
        await recorder().flush();
        return db()
          .select()
          .from(schema.jobRuns)
          .orderBy(sql`finished_at, id`);
      };
      const before = await runsNow();
      const billing = app.get(BillingService);
      const sweep = vi.spyOn(billing, "sweepPending").mockRejectedValueOnce(new Error("db hiccup"));
      await app.get(BillingJobs).run();
      sweep.mockRestore();
      const seen = new Set(before.map((run) => run.id));
      const runs = (await runsNow()).filter((run) => !seen.has(run.id));
      expect(runs.map((run) => run.job).sort()).toEqual(
        ["billing_sweep", "idempotency_prune", "renewal_reminders"].sort(),
      );
      const byJob = Object.fromEntries(runs.map((run) => [run.job, run]));
      expect(byJob.billing_sweep).toMatchObject({ status: "failed", errorClass: "Error" });
      expect(byJob.renewal_reminders).toMatchObject({ status: "succeeded" });
      expect(byJob.renewal_reminders!.detail).toMatch(/^sent \d+ reminders?$/);
      expect(byJob.idempotency_prune).toMatchObject({ status: "succeeded" });
      expect(await failuresNow()).toBe(failuresBefore + 1);
    });

    it("prunes by retention and records the maintenance run", async () => {
      const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
      const stale = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      const jobOld = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      const marker = `prune-${crypto.randomUUID()}@example.test`;
      const operation = `prune_${crypto.randomUUID()}`;
      await db()
        .insert(schema.productEvents)
        .values([
          { name: "link_opened", createdAt: old },
          { name: "link_opened", createdAt: stale },
        ]);
      await db()
        .insert(schema.failedSignIns)
        .values([
          { email: marker, method: "password", reason: "other", createdAt: stale },
          { email: marker, method: "password", reason: "other" },
        ]);
      await db()
        .insert(schema.operationFailures)
        .values([
          { kind: "pdf", operation, errorClass: "Error", message: "m", createdAt: stale },
          { kind: "pdf", operation, errorClass: "Error", message: "m" },
        ]);
      await db()
        .insert(schema.jobRuns)
        .values([
          { job: "maintenance", startedAt: jobOld, finishedAt: jobOld, status: "succeeded" },
        ]);
      await db()
        .insert(schema.backupRuns)
        .values([
          { startedAt: old, finishedAt: old, status: "succeeded" },
          { startedAt: stale, finishedAt: stale, status: "succeeded" },
        ]);

      await app.get(MaintenanceJobs).run();
      await recorder().flush();

      const one = async (q: Promise<{ n: number }[]>) => (await q)[0]!.n;
      const count = sql<number>`count(*)::int`;
      expect(
        await one(
          db()
            .select({ n: count })
            .from(schema.productEvents)
            .where(sql`created_at = ${old}`),
        ),
      ).toBe(0);
      expect(
        await one(
          db()
            .select({ n: count })
            .from(schema.productEvents)
            .where(sql`created_at = ${stale}`),
        ),
      ).toBe(1);
      const signIns = await db()
        .select()
        .from(schema.failedSignIns)
        .where(eq(schema.failedSignIns.email, marker));
      expect(signIns).toHaveLength(1);
      const failures = await db()
        .select()
        .from(schema.operationFailures)
        .where(eq(schema.operationFailures.operation, operation));
      expect(failures).toHaveLength(1);
      expect(
        await one(
          db()
            .select({ n: count })
            .from(schema.jobRuns)
            .where(sql`finished_at = ${jobOld}`),
        ),
      ).toBe(0);
      expect(
        await one(
          db()
            .select({ n: count })
            .from(schema.backupRuns)
            .where(sql`finished_at = ${old}`),
        ),
      ).toBe(0);
      expect(
        await one(
          db()
            .select({ n: count })
            .from(schema.backupRuns)
            .where(sql`finished_at = ${stale}`),
        ),
      ).toBe(1);
      const [run] = await db()
        .select()
        .from(schema.jobRuns)
        .where(eq(schema.jobRuns.job, "maintenance"))
        .orderBy(sql`finished_at desc`)
        .limit(1);
      expect(run).toMatchObject({ status: "succeeded" });
      expect(run!.detail).toMatch(/^removed \d+ old records?$/);
    });
  });

  describe("failed sign-ins", () => {
    const attempt = (email: string, password: string, ip = "203.0.113.77") =>
      api()
        .post("/api/v1/auth/sign-in/email")
        .set("Origin", WEB_ORIGIN)
        .set("X-Forwarded-For", ip)
        .send({ email, password });

    async function rowsFor(email: string) {
      await recorder().flush();
      return db()
        .select()
        .from(schema.failedSignIns)
        .where(eq(schema.failedSignIns.email, email.toLowerCase()));
    }

    it("records a wrong password with a masked address and no password", async () => {
      const { email } = await signUp(app);
      await attempt(email, "not-the-password").expect(401);
      const rows = await rowsFor(email);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        method: "password",
        reason: "wrong_password",
        ipMasked: "203.0.113.0/24",
      });
      // The whole row: only the typed email, the reason, the method and the masked network.
      expect(Object.keys(rows[0]!).sort()).toEqual(
        ["createdAt", "email", "id", "ipMasked", "method", "reason"].sort(),
      );
      const stored = JSON.stringify(rows);
      expect(stored).not.toContain("not-the-password");
      expect(stored).not.toContain("203.0.113.77");
    });

    it("takes the client address the way Express does, not from a spoofed left entry", async () => {
      const { email } = await signUp(app);
      await attempt(email, "not-the-password", "6.6.6.6, 203.0.113.77, 10.0.0.2").expect(401);
      const rows = await rowsFor(email);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.ipMasked).toBe("203.0.113.0/24");
    });

    it("records an unknown email", async () => {
      const email = uniqueEmail("Nobody");
      await attempt(email, "whatever-password").expect(401);
      const rows = await rowsFor(email);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ reason: "unknown_email" });
    });

    it("records a suspended account", async () => {
      const { email } = await signUp(app);
      await db().update(schema.users).set({ banned: true }).where(eq(schema.users.email, email));
      await attempt(email, "correct-horse-battery").expect(403);
      const rows = await rowsFor(email);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ reason: "banned" });
    });

    it("records nothing for a successful sign-in", async () => {
      const { email } = await signUp(app);
      await attempt(email, "correct-horse-battery").expect(200);
      expect(await rowsFor(email)).toHaveLength(0);
    });

    it("still signs in when recording is down", async () => {
      const { app: broken } = await createTestApp({
        configure: (builder) =>
          builder
            .overrideProvider(ActivityRecorder)
            .useValue(new ActivityRecorder(brokenConnection)),
      });
      try {
        const { email } = await signUp(broken);
        const agent = () =>
          request(broken.getHttpServer())
            .post("/api/v1/auth/sign-in/email")
            .set("Origin", WEB_ORIGIN);
        await agent().send({ email, password: "wrong-password!" }).expect(401);
        await agent().send({ email, password: "correct-horse-battery" }).expect(200);
      } finally {
        await broken.close();
      }
    });
  });

  describe("public event intake", () => {
    const send = (body: unknown, ip: string) =>
      api()
        .post("/api/v1/events")
        .set("X-Forwarded-For", ip)
        .send(body as object);

    async function forVisitor(id: string) {
      await recorder().flush();
      return db()
        .select()
        .from(schema.productEvents)
        .where(eq(schema.productEvents.anonymousId, id));
    }

    it("records an allowed generator event with the anonymous id and no account", async () => {
      const id = anonymousId();
      await send({ name: "generator_started", anonymousId: id }, "198.51.100.1").expect(204);
      const rows = await forVisitor(id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ name: "generator_started", accountId: null, props: {} });
    });

    it("answers 204 and records nothing for bad input", async () => {
      const id = anonymousId();
      const bad = [
        { name: "pdf_downloaded", anonymousId: id },
        { name: "generator_started", anonymousId: "not-a-uuid" },
        { name: "generator_started", anonymousId: id, props: { note: "x".repeat(2000) } },
        { name: "generator_started", anonymousId: id, props: { extra: 1 } },
        { name: "generator_started", anonymousId: id, accountId: crypto.randomUUID() },
        "nonsense",
        {},
      ];
      for (const body of bad) await send(body, "198.51.100.2").expect(204);
      expect(await forVisitor(id)).toHaveLength(0);
    });

    it("rate limits by the client address behind the proxy, however the left entries change", async () => {
      for (let i = 0; i < 10; i++) {
        await send(
          { name: "generator_started", anonymousId: anonymousId() },
          `9.9.9.${i}, 198.51.100.50, 10.0.0.2`,
        ).expect(204);
      }
      await send(
        { name: "generator_started", anonymousId: anonymousId() },
        "8.8.8.8, 198.51.100.50, 10.0.0.2",
      ).expect(429);
      await send(
        { name: "generator_started", anonymousId: anonymousId() },
        "198.51.100.51, 10.0.0.2",
      ).expect(204);
    });

    it("keeps one of each step per visitor per day", async () => {
      const id = anonymousId();
      for (let i = 0; i < 3; i++) {
        await send({ name: "generator_started", anonymousId: id }, `198.51.100.6${i}`).expect(204);
      }
      await send({ name: "generator_download_clicked", anonymousId: id }, "198.51.100.64").expect(
        204,
      );
      const rows = await forVisitor(id);
      expect(rows.map((row) => row.name).sort()).toEqual([
        "generator_download_clicked",
        "generator_started",
      ]);
    });

    it("drops events past the global limit but still answers 204", async () => {
      const { app: capped } = await createTestApp({
        configure: (builder) =>
          builder
            .overrideProvider(EVENT_INTAKE_GLOBAL_LIMITER)
            .useValue(new SlidingWindowLimiter(2, 60_000)),
      });
      try {
        const id = anonymousId();
        const names = [
          "generator_started",
          "generator_download_clicked",
          "generator_signup_clicked",
        ];
        for (const [i, name] of names.entries()) {
          await request(capped.getHttpServer())
            .post("/api/v1/events")
            .set("X-Forwarded-For", `198.51.100.7${i}`)
            .send({ name, anonymousId: id })
            .expect(204);
        }
        await capped.get(ActivityRecorder).flush();
        const rows = await capped
          .get<DatabaseConnection>(DATABASE)
          .db.select()
          .from(schema.productEvents)
          .where(eq(schema.productEvents.anonymousId, id));
        expect(rows).toHaveLength(2);
      } finally {
        await capped.close();
      }
    });

    it("rate limits per address", async () => {
      for (let i = 0; i < 10; i++) {
        await send(
          { name: "generator_started", anonymousId: anonymousId() },
          "198.51.100.3",
        ).expect(204);
      }
      const limited = await send(
        { name: "generator_started", anonymousId: anonymousId() },
        "198.51.100.3",
      ).expect(429);
      expect(limited.headers["retry-after"]).toBeDefined();
      await send({ name: "generator_started", anonymousId: anonymousId() }, "198.51.100.4").expect(
        204,
      );
    });
  });

  describe("guest import", () => {
    const draft = {
      business: {
        profileType: "individual",
        displayName: "Amani Njeri",
        contactEmail: "amani@example.test",
        phone: "0712 345 678",
      },
      client: { name: "Karibu Coffee", phone: "0722 111 222" },
      invoice: {
        issueDate: today,
        dueDate: today,
        items: [{ description: "Social content design", quantity: "1", unitPrice: "24000" }],
      },
    };

    it("records guest_invoice_imported with the anonymous id, once", async () => {
      const { cookie, email } = await signUp(app);
      const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email));
      const id = anonymousId();
      const result = await api()
        .post("/api/v1/guest-invoices/import")
        .set("Cookie", cookie)
        .send({ ...draft, anonymousId: id })
        .expect(201);
      const rows = await events("guest_invoice_imported", user!.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        anonymousId: id,
        invoiceId: result.body.invoiceId,
        props: { usedExistingBusiness: false },
      });
    });

    it("ignores a bad anonymous id and records nothing for a rejected draft", async () => {
      const { cookie, email } = await signUp(app);
      const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email));
      await api()
        .post("/api/v1/guest-invoices/import")
        .set("Cookie", cookie)
        .send({ ...draft, client: { name: "No phone" }, anonymousId: anonymousId() })
        .expect(400);
      expect(await events("guest_invoice_imported", user!.id)).toHaveLength(0);
      await api()
        .post("/api/v1/guest-invoices/import")
        .set("Cookie", cookie)
        .send({ ...draft, anonymousId: "nope" })
        .expect(201);
      const rows = await events("guest_invoice_imported", user!.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.anonymousId).toBeNull();
    });
  });

  describe("a recorder that cannot write", () => {
    it("never breaks the PDF, public link or import", async () => {
      const { app: broken } = await createTestApp({
        configure: (builder) =>
          builder
            .overrideProvider(ActivityRecorder)
            .useValue(new ActivityRecorder(brokenConnection)),
      });
      try {
        const http = () => request(broken.getHttpServer());
        const { cookie } = await signUp(broken);
        const businessId = await createBusiness(broken, cookie);
        const clientId = await createClient(broken, cookie, businessId);
        const base = `/api/v1/businesses/${businessId}/invoices`;
        const draft = await http()
          .post(base)
          .set("Cookie", cookie)
          .send({
            clientId,
            issueDate: today,
            dueDate: today,
            items: [{ description: "Work", quantity: "1", unitPrice: "100" }],
          })
          .expect(201);
        const path = `${base}/${draft.body.id}`;
        await http().post(`${path}/ready`).set("Cookie", cookie).expect(200);
        await http().get(`${path}/pdf`).set("Cookie", cookie).expect(200);
        const link = await http().post(`${path}/link`).set("Cookie", cookie).expect(201);
        await http().get(`/api/v1/public/invoices/${link.body.token}`).expect(200);
        await http().get(`/api/v1/public/invoices/${link.body.token}/pdf`).expect(200);
        await http()
          .post("/api/v1/events")
          .send({ name: "generator_started", anonymousId: anonymousId() })
          .expect(204);
      } finally {
        await broken.close();
      }
    });
  });
});
