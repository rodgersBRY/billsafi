import type { INestApplication } from "@nestjs/common";
import { type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import request from "supertest";
import { DATABASE } from "../src/database/database.module.js";
import { ReengagementService } from "../src/reengagement/reengagement.service.js";
import { unsubscribeToken } from "../src/reengagement/unsubscribe-token.js";
import { type CapturingMailer, createBusiness, createTestApp, signUp } from "./support/app.js";

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
});
