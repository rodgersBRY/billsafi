import type { INestApplication } from "@nestjs/common";
import {
  adminActivitySchema,
  adminAnalyticsSchema,
  adminOverridesQuerySchema,
  adminOverviewSchema,
  adminPlanPaymentsQuerySchema,
  adminSubscriptionsQuerySchema,
  adminTenantsQuerySchema,
  adminTrendsSchema,
} from "@billsafi/contracts";
import { type DatabaseConnection, schema, sql } from "@billsafi/db";
import { addNairobiMonths, FREE_PLAN, nairobiCalendarMonth } from "@billsafi/domain";
import request from "supertest";
import { AdminActivityService } from "../src/admin/metrics/admin-activity.service.js";
import { AdminAnalyticsService } from "../src/admin/metrics/admin-analytics.service.js";
import { AdminOverviewService } from "../src/admin/metrics/admin-overview.service.js";
import { AdminBillingService } from "../src/admin/subscriptions/admin-billing.service.js";
import { AdminSubscriptionsService } from "../src/admin/subscriptions/admin-subscriptions.service.js";
import { AdminTenantsService } from "../src/admin/tenants/admin-tenants.service.js";
import { DATABASE } from "../src/database/database.module.js";
import { uniqueEmail } from "./support/app.js";

/**
 * Super admin phase 4 (overview and analytics). Runs inside admin.e2e-spec.ts on its app and
 * admin, like the subscriptions suite. Other e2e files write to the same database, so the
 * clock is fixed in March 2031 and every row is seeded straight into the tables inside that
 * window; nothing else writes there, so in-range figures are exact. Totals that cover all
 * time (accounts, feature adoption, global attention counts) are compared with a snapshot
 * taken just before seeding.
 *
 * Nairobi is UTC+3, so a Nairobi midnight is 21:00Z the day before. The clock is Tuesday
 * 18 March 2031, 12:00 in Nairobi. The 30 day range starts at Nairobi midnight on 17
 * February (16 February 21:00Z), its previous period starts on 18 January.
 */
export interface AnalyticsSuiteContext {
  app: () => INestApplication;
  adminCookie: () => string;
  adminId: () => string;
}

const NOW = new Date("2031-03-18T09:00:00Z");
/** Start of the 30 day range, and of the Nairobi day 17 February. */
const RANGE_START = "2031-02-16T21:00:00Z";
const z = (value: string) => new Date(value);

export function analyticsSuite(ctx: AnalyticsSuiteContext) {
  const api = () => request(ctx.app().getHttpServer());
  const db = () => ctx.app().get<DatabaseConnection>(DATABASE).db;
  const get = (path: string) => api().get(`/api/v1/admin/${path}`).set("Cookie", ctx.adminCookie());
  const overviews = () => ctx.app().get(AdminOverviewService);
  const analytics = () => ctx.app().get(AdminAnalyticsService);
  const activities = () => ctx.app().get(AdminActivityService);

  /* ---------------------------------------------------------------- seeding helpers */

  interface Account {
    id: string;
    name: string;
    businessId: string;
    clientId: string;
    sequence: number;
    limit: number;
  }
  const periods = new Map<string, string>();
  let referenceCounter = 0;

  async function user(
    label: string,
    createdAt: string,
    options: { banned?: boolean; google?: boolean } = {},
  ) {
    const [row] = await db()
      .insert(schema.users)
      .values({ name: label, email: uniqueEmail(label), banned: options.banned ?? false })
      .returning({ id: schema.users.id });
    const id = row!.id;
    await db().execute(
      sql`update users set created_at = (${createdAt}::timestamptz at time zone 'UTC') where id = ${id}`,
    );
    if (options.google) {
      await db()
        .insert(schema.accounts)
        .values({
          accountId: `google-${id}`,
          providerId: "google",
          userId: id,
          updatedAt: new Date(),
        });
    }
    return id;
  }

  async function business(ownerUserId: string, createdAt: string, displayName = "Studio") {
    const [row] = await db()
      .insert(schema.businesses)
      .values({
        ownerUserId,
        profileType: "individual",
        displayName,
        contactEmail: "studio@example.com",
        phone: "+254712345678",
        createdAt: z(createdAt),
      })
      .returning({ id: schema.businesses.id });
    return row!.id;
  }

  async function client(businessId: string, createdAt: string) {
    const [row] = await db()
      .insert(schema.clients)
      .values({ businessId, name: "Client", phone: "+254722000111", createdAt: z(createdAt) })
      .returning({ id: schema.clients.id });
    return row!.id;
  }

  /** A user with one business and client created at `createdAt` (one hour after sign-up by default). */
  async function account(
    label: string,
    signedUpAt: string,
    options: { businessAt?: string; limit?: number; google?: boolean } = {},
  ): Promise<Account> {
    const id = await user(label, signedUpAt, { google: options.google });
    const businessAt = options.businessAt ?? signedUpAt;
    const businessId = await business(id, businessAt, `${label} studio`);
    const clientId = await client(businessId, businessAt);
    return {
      id,
      name: label,
      businessId,
      clientId,
      sequence: 0,
      limit: options.limit ?? FREE_PLAN.invoiceLimit,
    };
  }

  /** The Free allowance window containing `instant`, created once per account and month. */
  async function usagePeriod(owner: Account, instant: string) {
    const month = nairobiCalendarMonth(z(instant));
    const key = `${owner.id}:${month.start.toISOString()}`;
    const known = periods.get(key);
    if (known) return known;
    const [row] = await db()
      .insert(schema.usagePeriods)
      .values({
        userId: owner.id,
        planCode: FREE_PLAN.code,
        startsAt: month.start,
        endsAt: month.end,
        invoiceLimit: owner.limit,
      })
      .returning({ id: schema.usagePeriods.id });
    periods.set(key, row!.id);
    return row!.id;
  }

  /**
   * An invoice created at `createdAt`; with `readyAt` it is also made Ready (one issuance
   * on the plan allowance of that Nairobi month).
   */
  async function invoice(
    owner: Account,
    createdAt: string,
    readyAt: string | null,
    extra: Partial<typeof schema.invoices.$inferInsert> = {},
  ) {
    owner.sequence += 1;
    const [row] = await db()
      .insert(schema.invoices)
      .values({
        businessId: owner.businessId,
        clientId: owner.clientId,
        status: readyAt ? "ready" : "draft",
        sequenceNumber: readyAt ? owner.sequence : null,
        invoiceNumber: readyAt ? `INV-${owner.sequence}` : null,
        issueDate: "2031-03-01",
        dueDate: "2031-03-15",
        readyAt: readyAt ? z(readyAt) : null,
        createdAt: z(createdAt),
        ...extra,
      })
      .returning({ id: schema.invoices.id });
    if (readyAt) {
      await db()
        .insert(schema.invoiceIssuances)
        .values({
          userId: owner.id,
          businessId: owner.businessId,
          invoiceId: row!.id,
          usagePeriodId: await usagePeriod(owner, readyAt),
          source: "plan",
          issuedAt: z(readyAt),
        });
    }
    return row!.id;
  }

  interface PaymentOptions {
    purpose?: "pro_month" | "invoice_credits";
    quantity?: number;
    amount: string;
    currency?: "KES" | "USD";
    manual?: boolean;
    status?: "pending" | "succeeded" | "failed";
    createdAt: string;
    confirmedAt?: string;
    paidAt?: string;
    window?: { from: string; months: number; endedEarlyAt?: string };
    credits?: number;
  }

  /** A plan payment row; `window` records the Pro access it granted. */
  async function payment(userId: string, options: PaymentOptions) {
    const purpose = options.purpose ?? "pro_month";
    const manual = options.manual ?? false;
    const status = options.status ?? "succeeded";
    const from = options.window ? z(options.window.from) : null;
    const [row] = await db()
      .insert(schema.subscriptionPayments)
      .values({
        userId,
        purpose,
        quantity: options.quantity ?? options.window?.months ?? 1,
        amount: options.amount,
        currency: options.currency ?? "KES",
        phone: manual ? null : "+254712345678",
        status,
        provider: manual ? schema.MANUAL_PROVIDER : "fake",
        confirmedAt: options.confirmedAt ? z(options.confirmedAt) : null,
        grantedFrom: from,
        grantedUntil: from ? addNairobiMonths(from, options.window!.months) : null,
        endedEarlyAt: options.window?.endedEarlyAt ? z(options.window.endedEarlyAt) : null,
        creditsGranted: options.credits ?? 0,
        method: manual ? "bank_transfer" : null,
        externalReference: manual ? `ANALYTICS-${(referenceCounter += 1)}-${userId}` : null,
        paidAt: options.paidAt ? z(options.paidAt) : null,
        recordedBy: manual ? ctx.adminId() : null,
        createdAt: z(options.createdAt),
      })
      .returning({ id: schema.subscriptionPayments.id });
    return row!.id;
  }

  /** What billing stores for a run of paid months: the anchor, the months and the end. */
  async function run(userId: string, anchor: string, months: number) {
    const anchorAt = z(anchor);
    await db()
      .insert(schema.subscriptions)
      .values({
        userId,
        anchorAt,
        paidMonths: months,
        paidUntil: addNairobiMonths(anchorAt, months),
      });
  }

  async function gift(userId: string, from: string, months: number, createdAt: string) {
    const grantedFrom = z(from);
    await db()
      .insert(schema.accountGrants)
      .values({
        userId,
        kind: "pro_months",
        quantity: months,
        reason: "Analytics fixture",
        grantedBy: ctx.adminId(),
        grantedFrom,
        grantedUntil: addNairobiMonths(grantedFrom, months),
        createdAt: z(createdAt),
      });
  }

  async function override(
    userId: string,
    startsAt: string,
    expiresAt: string,
    extras: { revoked?: boolean } = {},
  ) {
    await db()
      .insert(schema.allowanceOverrides)
      .values({
        userId,
        extraInvoices: 5,
        startsAt: z(startsAt),
        expiresAt: z(expiresAt),
        reason: "Analytics fixture",
        createdBy: ctx.adminId(),
        createdAt: z(startsAt),
        ...(extras.revoked
          ? { revokedAt: z("2031-03-05T09:00:00Z"), revokedBy: ctx.adminId() }
          : {}),
      });
  }

  async function audit(
    action: string,
    targetId: string,
    occurredAt: string,
    outcome: "success" | "failure" = "success",
  ) {
    await db()
      .insert(schema.auditLogs)
      .values({
        occurredAt: z(occurredAt),
        actorUserId: ctx.adminId(),
        actorRole: "admin",
        action,
        targetType: "account",
        targetId,
        outcome,
        reason: "Analytics fixture",
      });
  }

  /* --------------------------------------------------------------------- the fixture */

  const ids: Record<string, string> = {};

  /**
   * Removes the fixture accounts of an earlier run (or of this one at the end), so the
   * window in March 2031 is empty each time and the database does not grow. Audit rows
   * are append-only and stay, but once their account is gone the feed no longer lists them.
   */
  async function removeFixture() {
    const owners = sql`(select id from users where email like 'an-%@example.test')`;
    const businesses = sql`(select id from businesses where owner_user_id in ${owners})`;
    const statements = [
      sql`delete from invoice_issuances where user_id in ${owners}`,
      sql`delete from invoice_links where business_id in ${businesses}`,
      sql`delete from invoice_payments where business_id in ${businesses}`,
      sql`delete from invoices where business_id in ${businesses}`,
      sql`delete from usage_periods where user_id in ${owners}`,
      sql`delete from clients where business_id in ${businesses}`,
      sql`delete from business_payment_instructions where business_id in ${businesses}`,
      sql`delete from businesses where owner_user_id in ${owners}`,
      sql`delete from subscription_payments where user_id in ${owners}`,
      sql`delete from account_grants where user_id in ${owners}`,
      sql`delete from allowance_overrides where user_id in ${owners}`,
      sql`delete from subscriptions where user_id in ${owners}`,
      sql`delete from accounts where user_id in ${owners}`,
      sql`delete from users where email like 'an-%@example.test'`,
    ];
    for (const statement of statements) await db().execute(statement);
  }
  let before: {
    overview: Awaited<ReturnType<AdminOverviewService["overview"]>>;
    trends: Awaited<ReturnType<AdminOverviewService["trends"]>>;
    analytics: Awaited<ReturnType<AdminAnalyticsService["analytics"]>>;
  };

  async function seed() {
    // Sign-ups in the current range, the 30 days to 18 March.
    const alpha = await account("an-alpha", "2031-03-10T09:00:00Z", {
      businessAt: "2031-03-10T09:10:00Z",
    });
    const bravo = await account("an-bravo", "2031-03-01T10:00:00Z", {
      businessAt: "2031-03-01T11:00:00Z",
      google: true,
    });
    const charlie = await account("an-charlie", "2031-03-17T09:00:00Z", {
      businessAt: "2031-03-17T09:30:00Z",
    });
    const delta = await user("an-delta", "2031-02-20T09:00:00Z");
    // X signs up, creates and readies an invoice at exactly the range start.
    const x = await account("an-x", RANGE_START);
    const f2 = await account("an-f2", "2031-03-08T08:00:00Z", {
      businessAt: "2031-03-08T08:30:00Z",
      limit: 3,
    });
    // Month edges: the last second of February and the first of March, Nairobi time.
    await user("an-edge-feb", "2031-02-28T20:59:59Z");
    await user("an-edge-mar", "2031-02-28T21:00:00Z");

    // Sign-ups in the previous period, 18 January to the range start.
    const echo = await account("an-echo", "2031-02-10T09:00:00Z", {
      businessAt: "2031-02-10T10:00:00Z",
    });
    const y = await account("an-y", "2031-02-16T20:59:59Z");
    const f3 = await account("an-f3", "2031-01-30T09:00:00Z", { limit: 3 });
    // Older accounts.
    const f1 = await account("an-f1", "2030-12-20T09:00:00Z", {
      businessAt: "2031-01-01T09:00:00Z",
      limit: 3,
    });
    const pro: Record<string, string> = {};
    for (const label of ["p1", "p2", "p3", "p4", "p5", "p6", "p7"]) {
      pro[label] = await user(`an-${label}`, "2030-12-01T09:00:00Z");
    }
    const banned = await user("an-banned", "2030-12-02T09:00:00Z", { banned: true });
    Object.assign(ids, {
      alpha: alpha.id,
      bravo: bravo.id,
      charlie: charlie.id,
      delta,
      x: x.id,
      f2: f2.id,
      echo: echo.id,
      y: y.id,
      f3: f3.id,
      f1: f1.id,
      banned,
      ...pro,
    });

    // Invoices. Alpha uses a discount, tax, a payment and a share link.
    const alphaInvoice = await invoice(alpha, "2031-03-10T10:00:00Z", "2031-03-10T12:00:00Z", {
      discountType: "percentage",
      discountValue: "10",
      taxRate: "16.00",
    });
    await db()
      .insert(schema.invoicePayments)
      .values({
        businessId: alpha.businessId,
        invoiceId: alphaInvoice,
        amount: "100.00",
        method: "mpesa",
        paymentDate: "2031-03-12",
        recordedByUserId: alpha.id,
        createdAt: z("2031-03-12T08:00:00Z"),
      });
    await db()
      .insert(schema.invoiceLinks)
      .values({
        businessId: alpha.businessId,
        invoiceId: alphaInvoice,
        tokenHash: `analytics-${crypto.randomUUID()}`,
        createdByUserId: alpha.id,
        expiresAt: z("2031-04-10T09:00:00Z"),
        createdAt: z("2031-03-10T13:00:00Z"),
      });
    await business(alpha.id, "2031-03-11T09:00:00Z", "Second studio");
    await db()
      .update(schema.businesses)
      .set({ logoKey: "logo" })
      .where(sql`id = ${alpha.businessId}`);
    for (const owner of [alpha, bravo]) {
      await db()
        .insert(schema.businessPaymentInstructions)
        .values({ businessId: owner.businessId, method: "mpesa_till", accountNumber: "123456" });
    }
    await invoice(bravo, "2031-03-12T10:00:00Z", "2031-03-12T11:00:00Z");
    await invoice(charlie, "2031-03-17T10:00:00Z", "2031-03-17T10:30:00Z");
    // One second after the clock: not yet happened, so no figure may count it.
    await invoice(charlie, "2031-03-18T09:00:01Z", "2031-03-18T09:00:01Z");
    await invoice(x, RANGE_START, RANGE_START);
    // Either side of a Nairobi midnight (15 March starts at 14 March 21:00Z).
    await invoice(x, "2031-03-14T20:59:59Z", "2031-03-14T20:59:59Z");
    await invoice(x, "2031-03-14T21:00:00Z", "2031-03-14T21:00:00Z");
    for (const day of ["09", "10", "11"]) {
      await invoice(f2, `2031-03-${day}T08:00:00Z`, `2031-03-${day}T09:00:00Z`);
    }
    await invoice(echo, "2031-02-12T09:00:00Z", "2031-02-12T10:00:00Z");
    await invoice(y, "2031-02-16T20:59:59Z", "2031-02-16T20:59:59Z");
    for (const day of ["03", "04", "05"]) {
      await invoice(f3, `2031-02-${day}T08:00:00Z`, `2031-02-${day}T09:00:00Z`);
    }
    for (const day of ["02", "03", "04"]) {
      await invoice(f1, `2031-01-${day}T08:00:00Z`, `2031-01-${day}T09:00:00Z`);
    }

    // Pro history. Windows are what paid for access; runs are what billing stores.
    // alpha: paid by M-Pesa on 11 March.
    await payment(alpha.id, {
      amount: "500.00",
      createdAt: "2031-03-11T08:00:00Z",
      confirmedAt: "2031-03-11T08:01:00Z",
      window: { from: "2031-03-11T08:01:00Z", months: 1 },
    });
    await run(alpha.id, "2031-03-11T08:01:00Z", 1);
    // bravo and p4: gifts. p4's runs from 1 February for 3 months.
    await gift(bravo.id, "2031-03-01T12:00:00Z", 1, "2031-03-01T12:00:00Z");
    await run(bravo.id, "2031-03-01T12:00:00Z", 1);
    await gift(pro.p4!, "2031-02-01T09:00:00Z", 3, "2031-02-01T09:00:00Z");
    await run(pro.p4!, "2031-02-01T09:00:00Z", 3);
    // p1: one USD month from 20 January that lapsed on 20 February and never renewed.
    await payment(pro.p1!, {
      manual: true,
      amount: "4.00",
      currency: "USD",
      createdAt: "2031-01-20T09:00:00Z",
      paidAt: "2031-01-20T09:00:00Z",
      window: { from: "2031-01-20T09:00:00Z", months: 1 },
    });
    await run(pro.p1!, "2031-01-20T09:00:00Z", 1);
    // p2: M-Pesa month from 20 January, renewed by hand for 20 February to 20 March.
    await payment(pro.p2!, {
      amount: "500.00",
      createdAt: "2031-01-20T09:00:00Z",
      confirmedAt: "2031-01-20T09:01:00Z",
      window: { from: "2031-01-20T09:00:00Z", months: 1 },
    });
    await payment(pro.p2!, {
      manual: true,
      amount: "520.00",
      createdAt: "2031-02-19T09:00:00Z",
      paidAt: "2031-02-19T09:00:00Z",
      window: { from: "2031-02-20T09:00:00Z", months: 1 },
    });
    await run(pro.p2!, "2031-01-20T09:00:00Z", 2);
    // p3: three USD months from 25 January that an admin cut to end on 25 February.
    await payment(pro.p3!, {
      manual: true,
      amount: "12.00",
      currency: "USD",
      createdAt: "2031-01-25T09:00:00Z",
      paidAt: "2031-01-25T09:00:00Z",
      window: { from: "2031-01-25T09:00:00Z", months: 3, endedEarlyAt: "2031-02-25T09:00:00Z" },
    });
    await run(pro.p3!, "2031-01-25T09:00:00Z", 1);
    await audit("tenant.end_pro", pro.p3!, "2031-02-10T12:00:00Z");
    // p5: a USD month from 20 February, ending on 20 March (within 7 days of the clock).
    await payment(pro.p5!, {
      manual: true,
      amount: "4.00",
      currency: "USD",
      createdAt: "2031-02-20T09:00:00Z",
      paidAt: "2031-02-20T09:00:00Z",
      window: { from: "2031-02-20T09:00:00Z", months: 1 },
    });
    await run(pro.p5!, "2031-02-20T09:00:00Z", 1);
    // p6 lapsed long before the range; p7 lapsed in the previous period.
    await payment(pro.p6!, {
      manual: true,
      amount: "4.00",
      currency: "USD",
      createdAt: "2030-11-01T09:00:00Z",
      paidAt: "2030-11-01T09:00:00Z",
      window: { from: "2030-11-01T09:00:00Z", months: 1 },
    });
    await run(pro.p6!, "2030-11-01T09:00:00Z", 1);
    await payment(pro.p7!, {
      manual: true,
      amount: "4.00",
      currency: "USD",
      createdAt: "2030-12-20T09:00:00Z",
      paidAt: "2030-12-20T09:00:00Z",
      window: { from: "2030-12-20T09:00:00Z", months: 1 },
    });
    await run(pro.p7!, "2030-12-20T09:00:00Z", 1);
    // echo: a USD month from 12 February to 12 March, in the previous period's money.
    await payment(echo.id, {
      manual: true,
      amount: "4.00",
      currency: "USD",
      createdAt: "2031-02-12T12:00:00Z",
      paidAt: "2031-02-12T12:00:00Z",
      window: { from: "2031-02-12T12:00:00Z", months: 1 },
    });
    await run(echo.id, "2031-02-12T12:00:00Z", 1);

    // Credit packs: charlie in range, f1 before the previous period (and within 14 days of f1's limit).
    await payment(charlie.id, {
      purpose: "invoice_credits",
      amount: "100.00",
      createdAt: "2031-03-17T10:55:00Z",
      confirmedAt: "2031-03-17T11:00:00Z",
      credits: 50,
    });
    await payment(f1.id, {
      purpose: "invoice_credits",
      amount: "100.00",
      createdAt: "2031-01-06T08:00:00Z",
      confirmedAt: "2031-01-06T08:01:00Z",
      credits: 50,
    });
    // A failed checkout in range; one stuck and one fresh pending checkout on 18 March.
    await payment(delta, {
      amount: "500.00",
      status: "failed",
      createdAt: "2031-03-05T09:00:00Z",
    });
    await payment(alpha.id, {
      amount: "500.00",
      status: "pending",
      createdAt: "2031-03-18T08:00:00Z",
    });
    await payment(alpha.id, {
      amount: "500.00",
      status: "pending",
      createdAt: "2031-03-18T08:55:00Z",
    });

    // Overrides: one ending in 4 days (counts), one far off, one revoked, one expired.
    await override(alpha.id, "2031-03-01T09:00:00Z", "2031-03-22T09:00:00Z");
    await override(bravo.id, "2031-03-01T09:00:00Z", "2031-04-30T09:00:00Z");
    await override(charlie.id, "2031-03-01T09:00:00Z", "2031-03-20T09:00:00Z", { revoked: true });
    await override(delta, "2031-02-01T09:00:00Z", "2031-03-01T09:00:00Z");

    // Admin actions for the feed: a suspension, a failed attempt that must not show, sessions.
    await audit("tenant.suspend", banned, "2031-03-18T07:00:00Z");
    await audit("tenant.suspend", delta, "2031-03-18T08:00:00Z", "failure");
    await audit("user.revoke_sessions", delta, "2031-03-17T15:00:00Z");
    await audit("tenant.reactivate", banned, "2031-03-16T09:00:00Z");
  }

  /* ----------------------------------------------------------------------- the tests */

  describe("overview and analytics (fixed clock, March 2031)", () => {
    beforeAll(async () => {
      await removeFixture();
      // Taken right before seeding; the seeded rows are the only difference afterwards.
      before = {
        overview: await overviews().overview("30d", NOW),
        trends: await overviews().trends("30d", NOW),
        analytics: await analytics().analytics("30d", NOW),
      };
      await seed();
    }, 120_000);

    afterAll(removeFixture, 60_000);

    it("cuts every range on Nairobi days, with a previous period of the same length", async () => {
      const iso = (value: string) => new Date(value).toISOString();
      const periods = async (range: "7d" | "30d" | "90d" | "12m") => {
        const { period, previousPeriod } = await overviews().overview(range, NOW);
        return { period, previousPeriod };
      };
      // Today plus the six days before it: Wednesday 12 March, Nairobi.
      expect(await periods("7d")).toEqual({
        period: { start: iso("2031-03-11T21:00:00Z"), end: NOW.toISOString() },
        previousPeriod: { start: iso("2031-03-04T21:00:00Z"), end: iso("2031-03-11T21:00:00Z") },
      });
      expect(await periods("30d")).toEqual({
        period: { start: iso(RANGE_START), end: NOW.toISOString() },
        previousPeriod: { start: iso("2031-01-17T21:00:00Z"), end: iso(RANGE_START) },
      });
      expect((await periods("90d")).period.start).toBe(iso("2030-12-18T21:00:00Z"));
      // Twelve calendar months ending with March; the 12 before them are the previous period.
      expect(await periods("12m")).toEqual({
        period: { start: iso("2030-03-31T21:00:00Z"), end: NOW.toISOString() },
        previousPeriod: { start: iso("2029-03-31T21:00:00Z"), end: iso("2030-03-31T21:00:00Z") },
      });
    });

    it("counts a moment exactly at the range start in the range and the second before in the previous period", async () => {
      const overview = await overviews().overview("30d", NOW);
      // X signs up and readies an invoice at the start; Y does so one second earlier.
      expect(overview.signups.current.total).toBe(8);
      expect(overview.signups.previous.total).toBe(3);
      expect(overview.invoicesReady).toEqual({ current: 9, previous: 5 });
    });

    it("returns each KPI as current and previous, exactly", async () => {
      const overview = await overviews().overview("30d", NOW);
      expect(overview.range).toBe("30d");
      expect(overview.signups).toEqual({
        current: { total: 8, google: 1, email: 7 },
        previous: { total: 3, google: 0, email: 3 },
      });
      // All time: this fixture's 20 accounts, 12 of which existed before the range.
      expect(overview.totalAccounts.current - before.overview.totalAccounts.current).toBe(20);
      expect(overview.totalAccounts.previous - before.overview.totalAccounts.previous).toBe(12);
      // Meaningful actions: an invoice created, made Ready, a payment recorded or a client added.
      expect(overview.activeAccounts).toEqual({ current: 5, previous: 3 });
      expect(overview.payingAccounts).toEqual({ current: 3, previous: 4 });
      expect(overview.complimentaryProAccounts).toEqual({ current: 2, previous: 1 });
      expect(overview.mrrUsd).toEqual({ current: "12.00", previous: "16.00" });
      expect(overview.collected).toEqual({
        kes: { current: "1120.00", previous: "500.00" },
        usd: { current: "4.00", previous: "20.00" },
      });
      // Pending checkouts are not settled; the manual payments are not M-Pesa checkouts.
      expect(overview.mpesa).toEqual({
        current: { succeeded: 2, failed: 1, successRate: 0.6667 },
        previous: { succeeded: 1, failed: 0, successRate: 1 },
      });
      expect(Object.values(overview.definitions).every((text) => text.length > 20)).toBe(true);
      expect(JSON.stringify(overview.definitions)).not.toMatch(/[–—]/);
    });

    it("measures Pro churn from the payments and gifts that covered each moment", async () => {
      const { proChurn } = await overviews().overview("30d", NOW);
      // Pro at the range start: p1, p2, p3, p4 (gift) and echo. Gone by the end: p1 (lapsed),
      // p3 (an admin ended it) and echo (lapsed). p2 renewed before the end, p4 is still on.
      expect(proChurn.current).toEqual({ rate: 0.6, count: 3, base: 5 });
      // Previous period: only p7 had Pro on 18 January, and it lapsed before the range began.
      expect(proChurn.previous).toEqual({ rate: 1, count: 1, base: 1 });
    });

    it("gives no rate when the base is zero", async () => {
      // Nine months on nothing happens in the range, and no Pro covers its first day.
      const empty = await overviews().overview("30d", new Date("2031-12-30T09:00:00Z"));
      expect(empty.signups.current.total).toBe(0);
      expect(empty.activation.current).toEqual({ rate: null, count: 0, base: 0 });
      expect(empty.mpesa.current).toEqual({ succeeded: 0, failed: 0, successRate: null });
      expect(empty.proChurn.current).toEqual({ rate: null, count: 0, base: 0 });
      expect(empty.collected.kes.current).toBe("0.00");
    });

    it("leaves sign-ups younger than 7 days out of the activation base", async () => {
      const { activation } = await overviews().overview("30d", NOW);
      // Base: every sign-up in range except charlie (1 day old). Activated within 7 days of
      // signing up: alpha (3h), X (0h) and f2 (25h), not bravo (11 days).
      expect(activation.current).toEqual({ rate: 0.4286, count: 3, base: 7 });
      expect(activation.previous).toEqual({ rate: 1, count: 3, base: 3 });
      // In the last 7 days only charlie signed up, and charlie is too young to count.
      const week = await overviews().overview("7d", NOW);
      expect(week.signups.current.total).toBe(1);
      expect(week.activation.current).toEqual({ rate: null, count: 0, base: 0 });
    });

    it("builds the attention list from the same predicates as the directories", async () => {
      const { attention } = await overviews().overview("30d", NOW);
      const tenants = ctx.app().get(AdminTenantsService);
      const subscriptions = ctx.app().get(AdminSubscriptionsService);
      const billing = ctx.app().get(AdminBillingService);
      const total = async (page: Promise<{ total: number }>) => (await page).total;

      expect(attention.stuckPayments).toBe(
        await total(
          subscriptions.payments(adminPlanPaymentsQuerySchema.parse({ stuck: "true" }), NOW),
        ),
      );
      expect(attention.suspendedAccounts).toBe(
        await total(
          tenants.list(adminTenantsQuerySchema.parse({ accountStatus: "suspended" }), NOW),
        ),
      );
      expect(attention.proEnding).toBe(
        await total(
          subscriptions.subscriptions(
            adminSubscriptionsQuerySchema.parse({ renewalWithin: "7" }),
            NOW,
          ),
        ),
      );
      expect(attention.proEnding).toBe(
        await total(
          tenants.list(adminTenantsQuerySchema.parse({ subscriptionStatus: "pro_ending" }), NOW),
        ),
      );
      expect(attention.proLapsed).toBe(
        await total(
          subscriptions.subscriptions(
            adminSubscriptionsQuerySchema.parse({ lapsedWithin: "30" }),
            NOW,
          ),
        ),
      );
      expect(attention.overridesEnding).toBe(
        await total(
          subscriptions.overrides(adminOverridesQuerySchema.parse({ endingWithin: "7" }), NOW),
        ),
      );
      const hits = (await billing.billing(NOW)).freeLimitHits.filter(
        (hit) => hit.month === "2031-03",
      );
      expect(attention.freeLimitReached).toBe(hits.length);

      // And the figures this fixture planted: p2 and p5 end within 7 days, p1, p3 and echo
      // lapsed in the last 30 days, alpha's override ends in 4 days (the revoked, far off and
      // expired ones do not count), f2 hit its limit this month, one stuck and one suspended.
      expect(attention.proEnding).toBe(2);
      expect(attention.proLapsed).toBe(3);
      expect(attention.overridesEnding).toBe(1);
      expect(attention.freeLimitReached).toBe(1);
      expect(attention.stuckPayments - before.overview.attention.stuckPayments).toBe(1);
      expect(attention.suspendedAccounts - before.overview.attention.suspendedAccounts).toBe(1);
    });

    it("returns zero-filled daily trend buckets with the right totals", async () => {
      const trends = await overviews().trends("30d", NOW);
      expect(trends.bucketSize).toBe("day");
      expect(trends.points).toHaveLength(30);
      expect(trends.points[0]!.bucketStart).toBe("2031-02-17");
      expect(trends.points.at(-1)!.bucketStart).toBe("2031-03-18");
      const by = (key: "signups" | "firstInvoices" | "invoicesReady") =>
        Object.fromEntries(
          trends.points
            .filter((point) => point[key] > 0)
            .map((point) => [point.bucketStart, point[key]]),
        );
      expect(by("signups")).toEqual({
        "2031-02-17": 1, // X, at the range start
        "2031-02-20": 1,
        "2031-02-28": 1, // the last second of February, Nairobi
        "2031-03-01": 2, // the first second of March, and bravo
        "2031-03-08": 1,
        "2031-03-10": 1,
        "2031-03-17": 1,
      });
      expect(by("firstInvoices")).toEqual({
        "2031-02-17": 1,
        "2031-03-09": 1,
        "2031-03-10": 1,
        "2031-03-12": 1,
        "2031-03-17": 1,
      });
      expect(by("invoicesReady")).toEqual({
        "2031-02-17": 1,
        "2031-03-09": 1,
        "2031-03-10": 2,
        "2031-03-11": 1,
        "2031-03-12": 1,
        "2031-03-14": 1, // 23:59:59 Nairobi
        "2031-03-15": 1, // midnight Nairobi
        "2031-03-17": 1,
      });
      const money = (key: "kesCollected" | "usdCollected") =>
        Object.fromEntries(
          trends.points
            .filter((point) => point[key] !== "0.00")
            .map((point) => [point.bucketStart, point[key]]),
        );
      expect(money("kesCollected")).toEqual({
        "2031-02-19": "520.00",
        "2031-03-11": "500.00",
        "2031-03-17": "100.00",
      });
      expect(money("usdCollected")).toEqual({ "2031-02-20": "4.00" });
      // An empty day is a zero, not a gap.
      expect(trends.points.find((point) => point.bucketStart === "2031-03-13")).toEqual({
        bucketStart: "2031-03-13",
        signups: 0,
        accountsTotal: trends.points.find((point) => point.bucketStart === "2031-03-12")!
          .accountsTotal,
        firstInvoices: 0,
        invoicesReady: 0,
        kesCollected: "0.00",
        usdCollected: "0.00",
      });
      // Cumulative accounts run from the count at the start and end at the total now.
      const overview = await overviews().overview("30d", NOW);
      expect(trends.points[0]!.accountsTotal).toBe(overview.totalAccounts.previous + 1);
      expect(trends.points.at(-1)!.accountsTotal).toBe(overview.totalAccounts.current);
      // Every series adds up to the overview's figure for the same range.
      const sum = (key: "signups" | "invoicesReady") =>
        trends.points.reduce((total, point) => total + point[key], 0);
      expect(sum("signups")).toBe(overview.signups.current.total);
      expect(sum("invoicesReady")).toBe(overview.invoicesReady.current);
    });

    it("buckets 90 days by Monday weeks and 12 months by calendar month", async () => {
      const weekly = await overviews().trends("90d", NOW);
      expect(weekly.bucketSize).toBe("week");
      expect(weekly.points.map((point) => point.bucketStart)).toEqual([
        "2030-12-19", // the range starts part way through a week
        "2030-12-23",
        "2030-12-30",
        "2031-01-06",
        "2031-01-13",
        "2031-01-20",
        "2031-01-27",
        "2031-02-03",
        "2031-02-10",
        "2031-02-17",
        "2031-02-24",
        "2031-03-03",
        "2031-03-10",
        "2031-03-17",
      ]);
      const by = (key: "signups" | "invoicesReady") =>
        Object.fromEntries(
          weekly.points
            .filter((point) => point[key] > 0)
            .map((point) => [point.bucketStart, point[key]]),
        );
      expect(by("invoicesReady")).toEqual({
        "2030-12-30": 3, // f1, 2 to 4 January
        "2031-02-03": 3, // f3, 3 to 5 February
        "2031-02-10": 2, // echo on the 12th, Y on the 16th at 23:59:59 Nairobi
        "2031-02-17": 1,
        "2031-03-03": 1, // Sunday 9 March still belongs to the week of Monday 3 March
        "2031-03-10": 6,
        "2031-03-17": 1,
      });

      const monthly = await overviews().trends("12m", NOW);
      expect(monthly.bucketSize).toBe("month");
      expect(monthly.points.map((point) => point.bucketStart)).toEqual([
        "2030-04-01",
        "2030-05-01",
        "2030-06-01",
        "2030-07-01",
        "2030-08-01",
        "2030-09-01",
        "2030-10-01",
        "2030-11-01",
        "2030-12-01",
        "2031-01-01",
        "2031-02-01",
        "2031-03-01",
      ]);
      const signups = Object.fromEntries(
        monthly.points.filter((point) => point.signups > 0).map((p) => [p.bucketStart, p.signups]),
      );
      // 23:59:59 on 28 February Nairobi time is February; the next second is March.
      expect(signups["2031-02-01"]).toBe(5);
      expect(signups["2031-03-01"]).toBe(5);
      expect(signups["2030-12-01"]).toBe(9);
      expect(signups["2031-01-01"]).toBe(1);
    });

    it("splits every account into a subscription mix that adds up", async () => {
      const { subscriptionMix: mix } = await overviews().trends("30d", NOW);
      expect(mix).toMatchObject({ proEnding: 2, proPaid: 1, proComplimentary: 2, lapsed: 3 });
      expect(mix.free + mix.proEnding + mix.proPaid + mix.proComplimentary + mix.lapsed).toBe(
        mix.total,
      );
      // 20 new accounts, 8 of them in one of the Pro groups; the rest are Free.
      expect(mix.total - before.trends.subscriptionMix.total).toBe(20);
      expect(mix.free - before.trends.subscriptionMix.free).toBe(12);
    });

    it("merges the feed newest first, cut to the limit, without failed admin actions", async () => {
      const { items } = await activities().activity(5, NOW);
      expect(items.map((item) => [item.kind, item.at])).toEqual([
        ["account_suspended", "2031-03-18T07:00:00.000Z"],
        ["sessions_revoked", "2031-03-17T15:00:00.000Z"],
        ["credit_pack", "2031-03-17T11:00:00.000Z"],
        ["first_invoice_ready", "2031-03-17T10:30:00.000Z"],
        ["signed_up", "2031-03-17T09:00:00.000Z"],
      ]);
      expect(items[0]).toMatchObject({
        id: expect.stringMatching(/^audit:/),
        account: { id: ids.banned, name: "an-banned" },
        admin: { id: ctx.adminId() },
        summary: "Account was suspended",
      });
      expect(items[2]).toMatchObject({
        account: { id: ids.charlie, name: "an-charlie" },
        admin: null,
        summary: "Bought 50 invoice credits for KES 100.00",
      });
      expect(items[4]!.summary).toBe("Signed up with email");

      // Every kind shows up somewhere; the failed suspension (08:00 on 18 March) never does.
      const all = (await activities().activity(500, NOW)).items;
      expect(new Set(all.map((item) => item.kind))).toEqual(
        new Set([
          "signed_up",
          "first_invoice_ready",
          "pro_payment",
          "credit_pack",
          "mpesa_failed",
          "grant_given",
          "override_added",
          "pro_ended",
          "account_suspended",
          "account_reactivated",
          "sessions_revoked",
        ]),
      );
      expect(all.some((item) => item.at === "2031-03-18T08:00:00.000Z")).toBe(false);
      // Nothing dated after the clock (charlie's invoice at 09:00:01) is listed.
      expect(all.every((item) => item.at <= NOW.toISOString())).toBe(true);
      expect(all.map((item) => item.at)).toEqual([...all.map((item) => item.at)].sort().reverse());
      const proPayment = all.find(
        (item) => item.kind === "pro_payment" && item.account?.name === "an-p2",
      );
      expect(proPayment).toBeDefined();
    });

    it("answers invoice volume, time to first invoice, adoption, plan limit and top accounts", async () => {
      const result = await analytics().analytics("30d", NOW);
      const day = (key: "created" | "ready") =>
        Object.fromEntries(
          result.invoiceVolume.points
            .filter((point) => point[key] > 0)
            .map((point) => [point.bucketStart, point[key]]),
        );
      expect(result.invoiceVolume.points).toHaveLength(30);
      const expectedDays = {
        "2031-02-17": 1,
        "2031-03-09": 1,
        "2031-03-10": 2,
        "2031-03-11": 1,
        "2031-03-12": 1,
        "2031-03-14": 1,
        "2031-03-15": 1,
        "2031-03-17": 1,
      };
      expect(day("ready")).toEqual(expectedDays);
      expect(day("created")).toEqual(expectedDays);
      // alpha 1, bravo 1, charlie 1, X 3 and f2 3 made invoices Ready: median 1.
      expect(result.invoiceVolume.accountsWithReady).toBe(5);
      expect(result.invoiceVolume.medianReadyPerAccount).toBe(1);

      // 8 sign-ups; 5 reached Ready after 0, 1.5, 3, 25 and 265 hours.
      expect(result.timeToFirstInvoice).toMatchObject({
        signups: 8,
        reached: 5,
        medianHours: 3,
        p75Hours: 25,
        activation: { rate: 0.4286, count: 3, base: 7 },
      });

      // Feature adoption is all time: compare with the snapshot before the fixture.
      const delta = (key: string) =>
        result.featureAdoption.items.find((item) => item.key === key)!.count -
        before.analytics.featureAdoption.items.find((item) => item.key === key)!.count;
      expect(result.featureAdoption.base - before.analytics.featureAdoption.base).toBe(9);
      expect(
        Object.fromEntries(result.featureAdoption.items.map((item) => [item.key, delta(item.key)])),
      ).toEqual({
        discount: 1,
        tax: 1,
        logo: 1,
        paymentInstructions: 2,
        shareLink: 1,
        paymentRecorded: 1,
        secondBusiness: 1,
        googleSignIn: 1,
      });
      for (const item of result.featureAdoption.items) {
        expect(item.base).toBe(result.featureAdoption.base);
        expect(item.share).toBe(
          item.base ? Math.round((item.count / item.base) * 10_000) / 10_000 : null,
        );
      }

      // Six months to March; f1 hit the limit in January and paid within 14 days, f3 in
      // February and f2 in March did not.
      expect(result.planLimit).toEqual([
        { month: "2030-10", reached: 0, boughtWithin14Days: 0 },
        { month: "2030-11", reached: 0, boughtWithin14Days: 0 },
        { month: "2030-12", reached: 0, boughtWithin14Days: 0 },
        { month: "2031-01", reached: 1, boughtWithin14Days: 1 },
        { month: "2031-02", reached: 1, boughtWithin14Days: 0 },
        { month: "2031-03", reached: 1, boughtWithin14Days: 0 },
      ]);

      expect(result.topAccounts).toHaveLength(5);
      expect(
        result.topAccounts
          .slice(0, 2)
          .map((row) => row.accountId)
          .sort(),
      ).toEqual([ids.x, ids.f2].sort());
      expect(result.topAccounts.slice(0, 2).map((row) => row.readyInvoices)).toEqual([3, 3]);
      expect(result.topAccounts.slice(2).map((row) => row.readyInvoices)).toEqual([1, 1, 1]);
      expect(result.topAccounts[0]).toMatchObject({ email: expect.stringContaining("@") });
    });

    it("keeps funnel and retention working beside the new routes", async () => {
      await get("funnel?days=7").expect(200);
      await get("funnel?days=365").expect(200);
      await get("retention?weeks=4").expect(200);
    });

    describe("routes", () => {
      it("validates the response of every route against its contract", async () => {
        adminOverviewSchema.parse((await get("overview").expect(200)).body);
        adminOverviewSchema.parse((await get("overview?range=12m").expect(200)).body);
        adminTrendsSchema.parse((await get("overview/trends?range=90d").expect(200)).body);
        adminActivitySchema.parse((await get("activity?limit=50").expect(200)).body);
        adminAnalyticsSchema.parse((await get("analytics?range=7d").expect(200)).body);
      });

      it("uses the 30 day range when none is given and treats a blank one the same", async () => {
        expect((await get("overview").expect(200)).body.range).toBe("30d");
        expect((await get("overview?range=").expect(200)).body.range).toBe("30d");
        expect((await get("overview/trends").expect(200)).body.range).toBe("30d");
        expect((await get("analytics").expect(200)).body.range).toBe("30d");
      });

      it("rejects an unknown range and an out of bounds limit", async () => {
        await get("overview?range=1y").expect(400);
        await get("overview/trends?range=30").expect(400);
        await get("analytics?range=all").expect(400);
        await get("activity?limit=0").expect(400);
        await get("activity?limit=51").expect(400);
        await get("activity?limit=abc").expect(400);
      });

      it("limits the feed to 20 items by default and 50 at most", async () => {
        const { body } = await get("activity").expect(200);
        expect(body.items.length).toBeLessThanOrEqual(20);
        const big = await get("activity?limit=50").expect(200);
        expect(big.body.items.length).toBeLessThanOrEqual(50);
      });

      it("adds the stuck and ending filters to the directories", async () => {
        await get("subscription-payments?stuck=true").expect(200);
        await get("subscription-payments?stuck=false").expect(200);
        await get("overrides?endingWithin=7").expect(200);
        await get("overrides?endingWithin=5").expect(400);
      });
    });
  });
}
