import { ConflictException, Inject, Injectable } from "@nestjs/common";
import type { AllowanceUsage } from "@billsafi/contracts";
import { and, type Database, type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import { FREE_PLAN, nairobiCalendarMonth, PRO_PLAN, proPeriodAt } from "@billsafi/domain";
import { DATABASE } from "../database/database.module.js";

const { usagePeriods, invoiceIssuances, subscriptions, subscriptionPayments, accountGrants } =
  schema;

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Db = Database | Transaction;
export type SubscriptionRow = typeof subscriptions.$inferSelect;

interface AllowanceWindow {
  plan: "free" | "pro";
  start: Date;
  end: Date;
  limit: number;
  carriedOver: number;
}

export interface Reservation {
  usagePeriodId: string;
  source: "plan" | "credit";
}

/**
 * Account-wide invoice allowance (D018, D019, D044, D051): the Free calendar
 * month or the current paid Pro period, then any purchased credits.
 */
@Injectable()
export class AllowanceService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  async usage(userId: string, at = new Date()): Promise<AllowanceUsage> {
    const db = this.connection.db;
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    return this.usageFor(db, userId, subscription ?? null, at);
  }

  /** Whether the account has paid Pro access right now. */
  async isPro(userId: string, at = new Date()): Promise<boolean> {
    const [subscription] = await this.connection.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    return Boolean(
      subscription?.anchorAt && proPeriodAt(subscription.anchorAt, subscription.paidMonths, at),
    );
  }

  async usageFor(
    db: Db,
    userId: string,
    subscription: SubscriptionRow | null,
    at: Date,
  ): Promise<AllowanceUsage> {
    const window = await this.window(db, userId, subscription, at);
    return {
      plan: window.plan,
      limit: window.limit,
      used: window.carriedOver + (await this.countPlanIssued(db, userId, window.start, window.end)),
      periodStart: window.start.toISOString(),
      periodEnd: window.end.toISOString(),
      credits: await this.credits(db, userId),
    };
  }

  /**
   * Locks the account's subscription row, creating it on first use. Every
   * allowance and plan change for the account runs behind this lock, so
   * concurrent Ready requests across its businesses and payment confirmations
   * happen one at a time.
   */
  async lockAccount(tx: Transaction, userId: string): Promise<SubscriptionRow> {
    await tx.insert(subscriptions).values({ userId }).onConflictDoNothing({
      target: subscriptions.userId,
    });
    const [locked] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .for("update");
    return locked!;
  }

  /**
   * Checks the remaining allowance under the account lock and returns what to
   * record the issuance against: the plan period while it has room, otherwise
   * a credit, otherwise 409 ALLOWANCE_REACHED.
   */
  async reserve(tx: Transaction, userId: string, at: Date): Promise<Reservation> {
    const subscription = await this.lockAccount(tx, userId);
    const window = await this.window(tx, userId, subscription, at);
    const usagePeriodId = await this.ensurePeriod(tx, userId, window);

    const used =
      window.carriedOver + (await this.countPlanIssued(tx, userId, window.start, window.end));
    if (used < window.limit) return { usagePeriodId, source: "plan" };

    const credits = await this.credits(tx, userId);
    if (credits > 0) return { usagePeriodId, source: "credit" };

    const planName = window.plan === "pro" ? "Pro" : "Free";
    const span = window.plan === "pro" ? "this Pro month" : "this month";
    throw new ConflictException({
      code: "ALLOWANCE_REACHED",
      message: `You've made ${window.limit} invoices Ready ${span}, the ${planName} plan limit.`,
      usage: { plan: window.plan, used, limit: window.limit, periodEnd: window.end.toISOString() },
    });
  }

  private async window(
    db: Db,
    userId: string,
    subscription: SubscriptionRow | null,
    at: Date,
  ): Promise<AllowanceWindow> {
    const pro =
      subscription?.anchorAt && proPeriodAt(subscription.anchorAt, subscription.paidMonths, at);
    if (pro) {
      return {
        plan: "pro",
        start: pro.start,
        end: pro.end,
        limit: PRO_PLAN.invoiceLimit,
        // Only the first period after (re)activation carries Free usage (D044, D051).
        carriedOver:
          pro.index === 0
            ? await this.countFreeIssuedBefore(db, userId, subscription.anchorAt!)
            : 0,
      };
    }
    // On Free, every plan-funded invoice this month counts, including ones issued on Pro (D044).
    const month = nairobiCalendarMonth(at);
    return { plan: "free", ...month, limit: FREE_PLAN.invoiceLimit, carriedOver: 0 };
  }

  private async ensurePeriod(tx: Transaction, userId: string, window: AllowanceWindow) {
    await tx
      .insert(usagePeriods)
      .values({
        userId,
        planCode: window.plan,
        startsAt: window.start,
        endsAt: window.end,
        invoiceLimit: window.limit,
        carriedOver: window.carriedOver,
      })
      .onConflictDoNothing({
        target: [usagePeriods.userId, usagePeriods.planCode, usagePeriods.startsAt],
      });
    const [period] = await tx
      .select({ id: usagePeriods.id })
      .from(usagePeriods)
      .where(
        and(
          eq(usagePeriods.userId, userId),
          eq(usagePeriods.planCode, window.plan),
          eq(usagePeriods.startsAt, window.start),
        ),
      );
    return period!.id;
  }

  private async countPlanIssued(db: Db, userId: string, start: Date, end: Date) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoiceIssuances)
      .where(
        and(
          eq(invoiceIssuances.userId, userId),
          eq(invoiceIssuances.source, "plan"),
          sql`${invoiceIssuances.issuedAt} >= ${start.toISOString()}`,
          sql`${invoiceIssuances.issuedAt} < ${end.toISOString()}`,
        ),
      );
    return row!.count;
  }

  /** Free-plan invoices issued earlier in the anchor's calendar month. */
  private async countFreeIssuedBefore(db: Db, userId: string, anchor: Date) {
    const month = nairobiCalendarMonth(anchor);
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoiceIssuances)
      .innerJoin(usagePeriods, eq(usagePeriods.id, invoiceIssuances.usagePeriodId))
      .where(
        and(
          eq(invoiceIssuances.userId, userId),
          eq(invoiceIssuances.source, "plan"),
          eq(usagePeriods.planCode, FREE_PLAN.code),
          sql`${invoiceIssuances.issuedAt} >= ${month.start.toISOString()}`,
          sql`${invoiceIssuances.issuedAt} < ${anchor.toISOString()}`,
        ),
      );
    return Math.min(row!.count, FREE_PLAN.invoiceLimit);
  }

  /** Credits bought plus credits an admin granted, minus credits used; they never expire (D051). */
  async credits(db: Db, userId: string): Promise<number> {
    const [bought] = await db
      .select({ total: sql<number>`coalesce(sum(${subscriptionPayments.creditsGranted}), 0)::int` })
      .from(subscriptionPayments)
      .where(
        and(eq(subscriptionPayments.userId, userId), eq(subscriptionPayments.status, "succeeded")),
      );
    const [granted] = await db
      .select({ total: sql<number>`coalesce(sum(${accountGrants.quantity}), 0)::int` })
      .from(accountGrants)
      .where(and(eq(accountGrants.userId, userId), eq(accountGrants.kind, "invoice_credits")));
    const [used] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoiceIssuances)
      .where(and(eq(invoiceIssuances.userId, userId), eq(invoiceIssuances.source, "credit")));
    return bought!.total + granted!.total - used!.count;
  }
}
