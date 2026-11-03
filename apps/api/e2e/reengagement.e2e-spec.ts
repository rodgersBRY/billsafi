import type { INestApplication } from "@nestjs/common";
import { type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import request from "supertest";
import { CheckInEmailsHealthProvider } from "../src/admin/health/check-in-emails-health.provider.js";
import { AdminCheckInsService } from "../src/admin/metrics/admin-check-ins.service.js";
import { DATABASE } from "../src/database/database.module.js";
import { ReengagementService } from "../src/reengagement/reengagement.service.js";
import { unsubscribeToken } from "../src/reengagement/unsubscribe-token.js";
import {
  type CapturingMailer,
  createBusiness,
  createTestApp,
  signUp,
  WEB_ORIGIN,
} from "./support/app.js";

// Other specs share the database and their accounts are not this spec's business.
process.env.REENGAGEMENT_DAILY_LIMIT = "1000";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Tomorrow at 10:00 Nairobi, so real sign-ins made by the test are always earlier. */
function nairobiMorning(daysAhead = 1): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  date.setUTCHours(7, 0, 0, 0);
  return date;
}

describe("check-in emails", () => {
  let app: INestApplication;
  let mailer: CapturingMailer;
  const api = () => request(app.getHttpServer());
  const db = () => app.get<DatabaseConnection>(DATABASE).db;
  const service = () => app.get(ReengagementService);

  beforeAll(async () => {
    ({ app, mailer } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  /** Signs up and moves registration, sessions and businesses back to `quietSince`. */
  async function quietAccount(quietSince: Date, withBusiness = false) {
    const { email, cookie } = await signUp(app);
    if (withBusiness) await createBusiness(app, cookie);
    const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email));
    const utc = sql`(${quietSince.toISOString()}::timestamptz at time zone 'UTC')`;
    await db().execute(sql`update users set created_at = ${utc} where id = ${user!.id}`);
    await db().execute(
      sql`update sessions set created_at = ${utc}, updated_at = ${utc} where user_id = ${user!.id}`,
    );
    await db().execute(
      sql`update businesses set created_at = ${quietSince.toISOString()}::timestamptz where owner_user_id = ${user!.id}`,
    );
    return { email, cookie, userId: user!.id };
  }

  const sentTo = (email: string) => mailer.sent.filter((message) => message.to === email);

  it("sends the next step once, spaced out, and stops after three", async () => {
    const now = nairobiMorning();
    const { email, userId } = await quietAccount(new Date(now.getTime() - 4 * DAY_MS));

    expect(await service().sendDue(now, [userId])).toEqual({ sent: 1 });
    expect(sentTo(email).at(-1)).toMatchObject({
      subject: "Your BillSafi account is ready when you are",
      headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      text: expect.stringContaining("utm_campaign=no_business_1"),
    });
    // A second run the same day sends nothing.
    expect(await service().sendDue(now, [userId])).toEqual({ sent: 0 });

    const later = new Date(now.getTime() + 8 * DAY_MS);
    expect(await service().sendDue(later, [userId])).toEqual({ sent: 1 });
    expect(sentTo(email).at(-1)?.subject).toBe("Send your first invoice today");

    const last = new Date(now.getTime() + 27 * DAY_MS);
    expect(await service().sendDue(last, [userId])).toEqual({ sent: 1 });
    expect(sentTo(email).at(-1)?.subject).toBe("Did something get in the way?");
    expect(sentTo(email).at(-1)?.html).toBeUndefined();

    const after = new Date(now.getTime() + 60 * DAY_MS);
    expect(await service().sendDue(after, [userId])).toEqual({ sent: 0 });
    expect(sentTo(email)).toHaveLength(4); // welcome + three check-ins
  });

  it("asks accounts with a business for their first invoice", async () => {
    const now = nairobiMorning();
    const { email, userId } = await quietAccount(new Date(now.getTime() - 5 * DAY_MS), true);
    await service().sendDue(now, [userId]);
    expect(sentTo(email).at(-1)?.subject).toBe("Your first invoice is a few clicks away");
  });

  it("leaves recent accounts alone and only sends in working hours", async () => {
    const now = nairobiMorning();
    const { userId } = await quietAccount(new Date(now.getTime() - DAY_MS));
    expect(await service().sendDue(now, [userId])).toEqual({ sent: 0 });

    const evening = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    expect(await service().sendDue(evening, [userId])).toEqual({
      sent: 0,
      skipped: "outside sending hours",
    });
  });

  it("stops after an unsubscribe and ignores forged tokens", async () => {
    const now = nairobiMorning();
    const { email, userId } = await quietAccount(new Date(now.getTime() - 4 * DAY_MS));
    const secret = process.env.BETTER_AUTH_SECRET!;

    await api()
      .post("/api/v1/email-preferences/unsubscribe")
      .send({ token: unsubscribeToken(`${secret}-wrong`, userId) })
      .expect(204);
    expect(await service().sendDue(now, [userId])).toEqual({ sent: 1 });

    // One-click unsubscribe from a mail app: token in the query string.
    await api()
      .post(`/api/v1/email-preferences/unsubscribe?token=${unsubscribeToken(secret, userId)}`)
      .type("form")
      .send("List-Unsubscribe=One-Click")
      .expect(204);
    const [optOut] = await db()
      .select()
      .from(schema.emailOptOuts)
      .where(eq(schema.emailOptOuts.userId, userId));
    expect(optOut).toBeDefined();

    const before = sentTo(email).length;
    expect(await service().sendDue(new Date(now.getTime() + 8 * DAY_MS), [userId])).toEqual({
      sent: 0,
    });
    expect(sentTo(email)).toHaveLength(before);
  });

  it("rejects a missing token", async () => {
    const response = await api().post("/api/v1/email-preferences/unsubscribe").send({}).expect(400);
    expect(response.body.issues[0].path).toBe("token");
  });

  describe("admin", () => {
    let adminCookie: string;

    beforeAll(async () => {
      const { email, cookie } = await signUp(app);
      await db().update(schema.users).set({ role: "admin" }).where(eq(schema.users.email, email));
      adminCookie = cookie;
    });

    /** Records an email as sent `daysAgo` days ago, as the job would have. */
    async function recordEmail(userId: string, daysAgo: number, step: 1 | 2 | 3 = 1) {
      const sentAt = new Date(Date.now() - daysAgo * DAY_MS);
      await db()
        .insert(schema.reengagementEmails)
        .values({ userId, segment: "no_business", step, quietSince: new Date(0), sentAt });
    }

    it("counts emails, returns and unsubscribes on the analytics panel", async () => {
      const figures = () => app.get(AdminCheckInsService).checkIns("7d");
      const before = await figures();

      // Came back: signed in after the email.
      const back = await quietAccount(new Date(Date.now() - 10 * DAY_MS));
      await recordEmail(back.userId, 3);
      await api()
        .post("/api/v1/auth/sign-in/email")
        .set("Origin", WEB_ORIGIN)
        .send({ email: back.email, password: "correct-horse-battery" })
        .expect(200);

      // Still quiet, and unsubscribed.
      const quiet = await quietAccount(new Date(Date.now() - 10 * DAY_MS));
      await recordEmail(quiet.userId, 2);
      await db().insert(schema.emailOptOuts).values({ userId: quiet.userId });

      // Outside the 7-day range.
      await recordEmail(quiet.userId, 20, 2);

      const after = await figures();
      expect(after.totals.sent - before.totals.sent).toBe(2);
      expect(after.totals.returned - before.totals.returned).toBe(1);
      expect(after.totals.stillOpen - before.totals.stillOpen).toBe(1);
      expect(after.totals.unsubscribed - before.totals.unsubscribed).toBe(1);
      const step = (data: typeof after) =>
        data.steps.find((s) => s.segment === "no_business" && s.step === 1)!;
      expect(step(after).sent - step(before).sent).toBe(2);
      expect(after.steps).toHaveLength(9);
      expect(after).toMatchObject({ enabled: false, returnWindowDays: 14 });

      // The route is admin only.
      await api().get("/api/v1/admin/check-ins?range=7d").set("Cookie", back.cookie).expect(404);
      const response = await api()
        .get("/api/v1/admin/check-ins?range=7d")
        .set("Cookie", adminCookie)
        .expect(200);
      expect(response.body.steps).toHaveLength(9);
    });

    it("shows an account's check-in emails and opt-out on its tenant page", async () => {
      const { userId } = await quietAccount(new Date(Date.now() - 30 * DAY_MS));
      await recordEmail(userId, 12, 1);
      await recordEmail(userId, 5, 2);
      await db().insert(schema.emailOptOuts).values({ userId });

      const response = await api()
        .get(`/api/v1/admin/tenants/${userId}`)
        .set("Cookie", adminCookie)
        .expect(200);
      expect(response.body.checkIns.optedOutAt).toEqual(expect.any(String));
      expect(
        response.body.checkIns.emails.map((e: { step: number; segment: string }) => [
          e.segment,
          e.step,
        ]),
      ).toEqual([
        ["no_business", 2],
        ["no_business", 1],
      ]);
    });

    it("reports the job on Health from its last run", async () => {
      const connection = app.get<DatabaseConnection>(DATABASE);
      const now = new Date(Date.now() + 365 * DAY_MS);
      const record = (minutesAgo: number, status: "succeeded" | "failed") => {
        const finishedAt = new Date(now.getTime() - minutesAgo * 60_000);
        return db()
          .insert(schema.jobRuns)
          .values({
            job: "reengagement_emails",
            startedAt: finishedAt,
            finishedAt,
            status,
            detail: status === "succeeded" ? "sent 3 emails" : null,
          });
      };
      const check = () => new CheckInEmailsHealthProvider(connection, true, 40).check(now);

      expect(await new CheckInEmailsHealthProvider(connection, false, 40).check(now)).toMatchObject(
        { status: "unknown", value: null },
      );

      await record(120, "succeeded");
      expect(await check()).toMatchObject({ status: "warning" });
      await record(10, "succeeded");
      expect(await check()).toMatchObject({
        status: "ok",
        detail: "Last run 10 minutes ago: sent 3 emails.",
      });
      await record(5, "failed");
      expect(await check()).toMatchObject({ status: "failing" });
      // Leave the newest run in the past again for later runs of this spec.
      await db().execute(
        sql`delete from job_runs where job = 'reengagement_emails' and finished_at > now()`,
      );
    });
  });
});
