import { Inject, Injectable } from "@nestjs/common";
import type { AdminBilling, AdminBillingPayment, AdminFreeLimitHit } from "@billsafi/contracts";
import { and, asc, type DatabaseConnection, desc, eq, schema, type SQL, sql } from "@billsafi/db";
import { FREE_PLAN, maskPhone, stuckPaymentCutoff } from "@billsafi/domain";
import { DATABASE } from "../database/database.module.js";
import { at, DAY_MS, iso, selectRows } from "./admin-sql.js";

const { subscriptionPayments, users } = schema;

const RECENT_PAYMENTS = 50;
const LIMIT_HIT_WINDOW_DAYS = 90;
const PAID_AFTER_DAYS = 30;
/** Plenty for one owner's review; keeps the response bounded. */
const MAX_LIMIT_HITS = 200;

const paymentColumns = {
  payment: subscriptionPayments,
  userEmail: users.email,
};
type PaymentWithEmail = { payment: typeof subscriptionPayments.$inferSelect; userEmail: string };

function toBillingPayment({ payment, userEmail }: PaymentWithEmail): AdminBillingPayment {
  return {
    id: payment.id,
    createdAt: payment.createdAt.toISOString(),
    userId: payment.userId,
    userEmail,
    purpose: payment.purpose,
    amountKes: payment.amount,
    priceUsd: payment.priceUsd,
    status: payment.status,
    phone: maskPhone(payment.phone),
    receipt: payment.receipt,
    resultDescription: payment.status === "failed" ? payment.resultDescription : null,
  };
}

/** Read-only plan payment health for the admin Billing tab. */
@Injectable()
export class AdminBillingService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  private get db() {
    return this.connection.db;
  }

  async billing(now = new Date()): Promise<AdminBilling> {
    const recent = await this.db
      .select(paymentColumns)
      .from(subscriptionPayments)
      .innerJoin(users, eq(users.id, subscriptionPayments.userId))
      .orderBy(desc(subscriptionPayments.createdAt))
      .limit(RECENT_PAYMENTS);

    const stuck = await this.db
      .select(paymentColumns)
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
      recentPayments: recent.map(toBillingPayment),
      stuckPayments: stuck.map(toBillingPayment),
      freeLimitHits: await this.freeLimitHits(now),
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Free months in which the account made its limit-th plan-funded invoice
   * Ready within the last 90 days. Every plan-funded invoice in the month's
   * window counts towards the limit, Pro ones included (D044), but the hit is
   * only reported when that limit-th invoice was charged to the Free period:
   * if it went to a Pro period, the account had already upgraded. "Paid" means
   * a succeeded plan payment from the moment of the hit until 30 days after
   * the month ended, so paying right away to keep going counts too.
   */
  private async freeLimitHits(now: Date): Promise<AdminFreeLimitHit[]> {
    const since = new Date(now.getTime() - LIMIT_HIT_WINDOW_DAYS * DAY_MS);
    const query: SQL = sql`
      with hits as (
        select up.id, up.user_id, up.starts_at, up.ends_at, up.invoice_limit,
               nth.issued_at as hit_at, nth.usage_period_id as hit_period_id
        from usage_periods up
        -- The issuance that used up the allowance: the limit-th one in the month.
        cross join lateral (
          select ii.issued_at, ii.usage_period_id from invoice_issuances ii
          where ii.user_id = up.user_id and ii.source = 'plan'
            and ii.issued_at >= up.starts_at and ii.issued_at < up.ends_at
          order by ii.issued_at, ii.id
          offset up.invoice_limit - 1 limit 1
        ) nth
        where up.plan_code = ${FREE_PLAN.code} and up.ends_at > ${at(since)}
      )
      select
        h.user_id as "userId",
        u.email as "userEmail",
        to_char(h.starts_at at time zone 'Africa/Nairobi', 'YYYY-MM') as month,
        h.invoice_limit as "limit",
        ${iso(sql`h.hit_at`)} as "hitAt",
        exists (
          select 1 from subscription_payments sp
          where sp.user_id = h.user_id and sp.status = 'succeeded'
            and sp.confirmed_at >= h.hit_at
            and sp.confirmed_at < h.ends_at + make_interval(days => ${PAID_AFTER_DAYS})
        ) as "paidWithin30Days"
      from hits h
      join users u on u.id = h.user_id
      where h.hit_period_id = h.id
        and h.hit_at >= ${at(since)} and h.hit_at < ${at(now)}
      order by h.hit_at desc
      limit ${MAX_LIMIT_HITS}
    `;
    return selectRows<AdminFreeLimitHit>(this.db, query);
  }
}
