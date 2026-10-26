import { Inject, Injectable } from "@nestjs/common";
import type { AdminBilling, AdminBillingQuery, AdminFreeLimitHit } from "@billsafi/contracts";
import { and, asc, type DatabaseConnection, desc, eq, schema, type SQL, sql } from "@billsafi/db";
import { nairobiCalendarMonth, stuckPaymentCutoff } from "@billsafi/domain";
import { DATABASE } from "../../database/database.module.js";
import { planPaymentColumns, toAdminPlanPayment } from "./payments.js";
import { at, DAY_MS, iso, paidOnSql, selectRows } from "../shared/admin-sql.js";
import { freeLimitHitsCte, realFreeLimitHit } from "../shared/free-limit-hits.js";

const { subscriptionPayments, users } = schema;

const RECENT_PAYMENTS = 50;
const LIMIT_HIT_WINDOW_DAYS = 90;
const PAID_AFTER_DAYS = 30;
/** Plenty for one owner's review; keeps the response bounded. */
const MAX_LIMIT_HITS = 200;

/** Read-only plan payment health for the admin Billing tab. */
@Injectable()
export class AdminBillingService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  private get db() {
    return this.connection.db;
  }

  async billing(
    limitHits?: AdminBillingQuery["limitHits"],
    now = new Date(),
  ): Promise<AdminBilling> {
    const recent = await this.db
      .select(planPaymentColumns)
      .from(subscriptionPayments)
      .innerJoin(users, eq(users.id, subscriptionPayments.userId))
      .orderBy(desc(subscriptionPayments.createdAt))
      .limit(RECENT_PAYMENTS);

    const stuck = await this.db
      .select(planPaymentColumns)
      .from(subscriptionPayments)
      .innerJoin(users, eq(users.id, subscriptionPayments.userId))
      .where(
        and(
          eq(subscriptionPayments.status, "pending"),
          sql`${subscriptionPayments.createdAt} < ${at(stuckPaymentCutoff(now))}`,
        ),
      )
      .orderBy(asc(subscriptionPayments.createdAt));

    return {
      recentPayments: recent.map(toAdminPlanPayment),
      stuckPayments: stuck.map(toAdminPlanPayment),
      freeLimitHits: await this.freeLimitHits(now, limitHits === "this_month"),
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Free months in which the account made its limit-th plan-funded invoice
   * Ready within the last 90 days, the limit being the plan's plus any override
   * extra in force at that moment. Every plan-funded invoice in the month's
   * window counts towards the limit, Pro ones included (D044), but the hit is
   * only reported when that limit-th invoice was charged to the Free period:
   * if it went to a Pro period, the account had already upgraded. "Paid" means
   * a succeeded plan payment from the moment of the hit until 30 days after
   * the month ended, so paying right away to keep going counts too.
   */
  private async freeLimitHits(now: Date, thisMonth: boolean): Promise<AdminFreeLimitHit[]> {
    // This month's hits are one per Free account, so that list needs no cap.
    const since = thisMonth
      ? nairobiCalendarMonth(now).start
      : new Date(now.getTime() - LIMIT_HIT_WINDOW_DAYS * DAY_MS);
    const query: SQL = sql`
      with ${freeLimitHitsCte(since)}
      select
        h.user_id as "userId",
        u.email as "userEmail",
        to_char(h.starts_at at time zone 'Africa/Nairobi', 'YYYY-MM') as month,
        (h.invoice_limit + h.extra)::int as "limit",
        h.extra as "extraInvoices",
        ${iso(sql`h.hit_at`)} as "hitAt",
        exists (
          select 1 from subscription_payments sp
          where sp.user_id = h.user_id and sp.status = 'succeeded'
            and ${paidOnSql("sp")} >= h.hit_at
            and ${paidOnSql("sp")} < h.ends_at + make_interval(days => ${PAID_AFTER_DAYS})
        ) as "paidWithin30Days"
      from hits h
      join users u on u.id = h.user_id
      where ${realFreeLimitHit(since, now)}
      order by h.hit_at desc
      ${thisMonth ? sql`` : sql`limit ${MAX_LIMIT_HITS}`}
    `;
    return selectRows<AdminFreeLimitHit>(this.db, query);
  }
}
