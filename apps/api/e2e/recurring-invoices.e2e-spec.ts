import type { INestApplication } from "@nestjs/common";
import { type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import { addCalendarDays, addNairobiMonths, nairobiDate, PRO_PLAN } from "@billsafi/domain";
import request from "supertest";
import { DATABASE } from "../src/database/database.module.js";
import { RecurringRunner } from "../src/recurring/recurring-runner.service.js";
import {
  type CapturingMailer,
  createBusiness,
  createClient,
  createTestApp,
  signUp,
} from "./support/app.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const today = nairobiDate(new Date());
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

describe("recurring invoices", () => {
  let app: INestApplication;
  let mailer: CapturingMailer;
  let db: DatabaseConnection["db"];
  let runner: RecurringRunner;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mailer } = await createTestApp());
    db = app.get<DatabaseConnection>(DATABASE).db;
    runner = app.get(RecurringRunner);
  });

  afterAll(async () => {
    await app.close();
  });

  async function setup({ pro = true } = {}) {
    const { cookie, email } = await signUp(app);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    const userId = user!.id;
    if (pro) await setPro(userId, true);
    const businessId = await createBusiness(app, cookie);
    const clientId = await createClient(app, cookie, businessId);
    const path = `/api/v1/businesses/${businessId}/recurring-invoices`;
    const body = (overrides: Record<string, unknown> = {}) => ({
      clientId,
      frequency: "monthly",
      mode: "draft",
      startDate: today,
      paymentTermsDays: 7,
      items: [{ description: "Retainer for {month} {year}", quantity: "1", unitPrice: "20000" }],
      notes: "Thanks for {month}",
      ...overrides,
    });
    const create = async (overrides: Record<string, unknown> = {}) =>
      (await api().post(path).set("Cookie", cookie).send(body(overrides)).expect(201)).body as {
        id: string;
        nextRunDate: string | null;
      };
    const get = async (id: string) =>
      (await api().get(`${path}/${id}`).set("Cookie", cookie).expect(200)).body;
    const action = (id: string, name: string) =>
      api().post(`${path}/${id}/${name}`).set("Cookie", cookie);
    return { cookie, email, userId, businessId, clientId, path, body, create, get, action };
  }

  /** A year of Pro from now, or Pro that ended last month. */
  async function setPro(userId: string, active: boolean) {
    const anchorAt = active ? new Date() : addNairobiMonths(new Date(), -2);
    await db
      .insert(schema.subscriptions)
      .values({
        userId,
        anchorAt,
        paidMonths: active ? 12 : 1,
        paidUntil: addNairobiMonths(anchorAt, active ? 12 : 1),
      })
      .onConflictDoUpdate({
        target: schema.subscriptions.userId,
        set: {
          anchorAt,
          paidMonths: active ? 12 : 1,
          paidUntil: addNairobiMonths(anchorAt, active ? 12 : 1),
        },
      });
  }

  it("is Pro only to set up", async () => {
    const { cookie, path, body } = await setup({ pro: false });
    const refused = await api().post(path).set("Cookie", cookie).send(body()).expect(409);
    expect(refused.body.code).toBe("PRO_REQUIRED");
  });

  it("validates the schedule", async () => {
    const { cookie, path, body } = await setup();
    const past = await api()
      .post(path)
      .set("Cookie", cookie)
      .send(body({ startDate: addCalendarDays(today, -1) }))
      .expect(400);
    expect(past.body.issues).toEqual([
      { path: "startDate", message: "Start date can't be in the past" },
    ]);
    const both = await api()
      .post(path)
      .set("Cookie", cookie)
      .send(body({ endDate: addCalendarDays(today, 90), maxCount: 3 }))
      .expect(400);
    expect(both.body.issues[0].path).toBe("maxCount");
    const empty = await api()
      .post(path)
      .set("Cookie", cookie)
      .send(body({ items: [] }));
    expect(empty.status).toBe(400);
  });

  it("makes a draft each period with month placeholders filled", async () => {
    const { cookie, email, businessId, create, get } = await setup();
    const schedule = await create();
    const detail = await get(schedule.id);
    expect(detail).toMatchObject({ status: "active", nextRunDate: today, total: "20000.00" });
    expect(detail.upcoming).toHaveLength(3);

    const made = await runner.runOne(schedule.id, new Date());
    expect(made).toMatchObject({ outcome: "draft", skipped: 0 });
    // A second run the same day finds nothing due.
    expect(await runner.runOne(schedule.id, new Date())).toBeNull();

    const after = await get(schedule.id);
    expect(after.generatedCount).toBe(1);
    expect(after.nextRunDate > today).toBe(true);
    expect(after.invoices).toHaveLength(1);

    const invoice = (
      await api()
        .get(`/api/v1/businesses/${businessId}/invoices/${after.invoices[0].id}`)
        .set("Cookie", cookie)
        .expect(200)
    ).body;
    const month = new Date(`${today}T00:00:00Z`).toLocaleString("en-US", {
      month: "long",
      timeZone: "UTC",
    });
    expect(invoice).toMatchObject({
      status: "draft",
      issueDate: today,
      dueDate: addCalendarDays(today, 7),
      recurringInvoiceId: schedule.id,
      notes: `Thanks for ${month}`,
    });
    expect(invoice.items[0].description).toBe(`Retainer for ${month} ${today.slice(0, 4)}`);
    expect(mailer.lastTo(email)?.subject).toBe("Invoice for Acacia Creative is ready to review");
  });

  it("makes Ready invoices with a number in Ready mode", async () => {
    const { email, create, get } = await setup();
    const schedule = await create({ mode: "ready" });
    await runner.runOne(schedule.id, new Date());
    const detail = await get(schedule.id);
    expect(detail.invoices[0]).toMatchObject({ status: "ready", invoiceNumber: "INV-00001" });
    expect(mailer.lastTo(email)?.subject).toBe(
      "Invoice INV-00001 for Acacia Creative is ready to send",
    );
  });

  it("makes only the latest missed period", async () => {
    const { email, create, get } = await setup();
    const schedule = await create();
    const made = await runner.runOne(schedule.id, daysFromNow(75));
    expect(made).toMatchObject({ skipped: 2 });
    const detail = await get(schedule.id);
    expect(detail.generatedCount).toBe(1);
    expect(detail.invoices).toHaveLength(1);
    expect(mailer.lastTo(email)?.text).toContain("2 earlier periods passed without an invoice");
  });

  it("saves a draft when the allowance is used up", async () => {
    const { userId, businessId, clientId, email, create, get } = await setup();
    const schedule = await create({ mode: "ready" });
    // Use up the Pro allowance: one real Ready invoice creates the period, the rest are filler.
    const first = await create({ mode: "ready" });
    await runner.runOne(first.id, new Date());
    const [period] = await db
      .select()
      .from(schema.usagePeriods)
      .where(eq(schema.usagePeriods.userId, userId));
    await db.execute(sql`
      with filler as (
        insert into invoices (business_id, client_id, status, sequence_number, invoice_number,
          system_invoice_number, issue_date, due_date)
        select ${businessId}, ${clientId}, 'ready', n, 'F-' || n, 'F-' || n, ${today}, ${today}
        from generate_series(1000, ${1000 + PRO_PLAN.invoiceLimit - 2}) as n
        returning id
      )
      insert into invoice_issuances (user_id, business_id, invoice_id, usage_period_id, issued_at)
      select ${userId}, ${businessId}, id, ${period!.id}, ${new Date().toISOString()} from filler`);

    const made = await runner.runOne(schedule.id, new Date());
    expect(made).toMatchObject({ outcome: "allowance_reached" });
    const detail = await get(schedule.id);
    expect(detail.invoices[0]).toMatchObject({ status: "draft", invoiceNumber: null });
    expect(detail.generatedCount).toBe(1);
    expect(mailer.lastTo(email)?.subject).toBe("Invoice for Acacia Creative saved as a draft");
  });

  it("pauses when Pro ends and restarts when Pro comes back", async () => {
    const { userId, create, get, action } = await setup();
    const schedule = await create();
    await setPro(userId, false);
    expect(await runner.runOne(schedule.id, new Date())).toBe("paused");
    expect(await get(schedule.id)).toMatchObject({ status: "paused", pausedReason: "pro_ended" });
    // Pausing and ending still work without Pro; resuming doesn't.
    expect((await action(schedule.id, "resume").expect(409)).body.code).toBe("PRO_REQUIRED");

    await setPro(userId, true);
    expect(await runner.runOne(schedule.id, new Date())).toMatchObject({ outcome: "draft" });
    expect(await get(schedule.id)).toMatchObject({ status: "active", generatedCount: 1 });
  });

  it("pauses when the client is archived and won't resume until it's restored", async () => {
    const { cookie, businessId, clientId, create, get, action } = await setup();
    const schedule = await create();
    await api()
      .post(`/api/v1/businesses/${businessId}/clients/${clientId}/archive`)
      .set("Cookie", cookie)
      .expect(200);
    expect(await get(schedule.id)).toMatchObject({
      status: "paused",
      pausedReason: "client_archived",
    });
    await action(schedule.id, "resume").expect(409);
    expect(await runner.runOne(schedule.id, new Date())).toBeNull();
  });

  it("pauses, resumes, skips and ends", async () => {
    const { create, get, action } = await setup();
    const schedule = await create();
    expect((await action(schedule.id, "pause").expect(200)).body.status).toBe("paused");
    expect(await runner.runOne(schedule.id, new Date())).toBeNull();
    expect((await action(schedule.id, "resume").expect(200)).body.status).toBe("active");

    const skipped = (await action(schedule.id, "skip").expect(200)).body;
    expect(skipped.nextRunDate > today).toBe(true);
    expect(await runner.runOne(schedule.id, new Date())).toBeNull();

    const ended = (await action(schedule.id, "end").expect(200)).body;
    expect(ended).toMatchObject({ status: "ended", nextRunDate: null, upcoming: [] });
    await action(schedule.id, "pause").expect(409);
    expect((await get(schedule.id)).invoices).toHaveLength(0);
  });

  it("ends after the set number of invoices", async () => {
    const { create, get } = await setup();
    const schedule = await create({ maxCount: 1 });
    await runner.runOne(schedule.id, new Date());
    expect(await get(schedule.id)).toMatchObject({
      status: "ended",
      nextRunDate: null,
      generatedCount: 1,
    });
  });

  it("applies edits to future runs only", async () => {
    const { cookie, path, body, create, get } = await setup();
    const schedule = await create();
    await runner.runOne(schedule.id, new Date());
    const edited = await api()
      .put(`${path}/${schedule.id}`)
      .set("Cookie", cookie)
      .send(body({ items: [{ description: "New rate", quantity: "1", unitPrice: "25000" }] }))
      .expect(200);
    expect(edited.body).toMatchObject({ total: "25000.00", generatedCount: 1 });
    expect((await get(schedule.id)).invoices[0].total).toBe("20000.00");
  });

  it("returns 404 for another account's schedules", async () => {
    const owner = await setup();
    const schedule = await owner.create();
    const other = await setup();
    await api().get(`${other.path}/${schedule.id}`).set("Cookie", other.cookie).expect(404);
    await api().get(`${owner.path}/${schedule.id}`).set("Cookie", other.cookie).expect(404);
    await api().post(`${other.path}/${schedule.id}/end`).set("Cookie", other.cookie).expect(404);
  });

  it("keeps the default mode on the business", async () => {
    const { cookie, businessId } = await setup();
    const updated = await api()
      .patch(`/api/v1/businesses/${businessId}`)
      .set("Cookie", cookie)
      .send({ defaultRecurringMode: "ready" })
      .expect(200);
    expect(updated.body).toMatchObject({
      defaultRecurringMode: "ready",
      defaultPaymentTermsDays: 14,
    });
  });
});
