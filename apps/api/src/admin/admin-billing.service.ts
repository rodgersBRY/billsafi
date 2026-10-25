import { Inject, Injectable } from "@nestjs/common";
import type { AdminBilling, AdminFreeLimitHit } from "@billsafi/contracts";
import { and, asc, type DatabaseConnection, desc, eq, schema, type SQL, sql } from "@billsafi/db";
import { FREE_PLAN, stuckPaymentCutoff } from "@billsafi/domain";
import { DATABASE } from "../database/database.module.js";
import { planPaymentColumns, toAdminPlanPayment } from "./admin-payments.js";
import { at, DAY_MS, iso, selectRows } from "./admin-sql.js";

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

  async billing(now = new Date()): Promise<AdminBilling> {
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
      freeLimitHits: await this.freeLimitHits(now),
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
  private async freeLimitHits(now: Date): Promise<AdminFreeLimitHit[]> {
    const since = new Date(now.getTime() - LIMIT_HIT_WINDOW_DAYS * DAY_MS);
    const query: SQL = sql`
      with ranked as (
        select up.id, up.user_id, up.starts_at, up.ends_at, up.invoice_limit,
               ii.issued_at, ii.usage_period_id,
               row_number() over (partition by up.id order by ii.issued_at, ii.id) as n,
               -- Overrides in force when this invoice was made Ready (revoked ones until then).
               (select coalesce(sum(o.extra_invoices), 0) from allowance_overrides o
                where o.user_id = up.user_id and o.starts_at <= ii.issued_at
                  and o.expires_at > ii.issued_at
                  and (o.revoked_at is null or o.revoked_at > ii.issued_at))::int as extra
        from usage_periods up
        join invoice_issuances ii on ii.user_id = up.user_id and ii.source = 'plan'
          and ii.issued_at >= up.starts_at and ii.issued_at < up.ends_at
        where up.plan_code = ${FREE_PLAN.code} and up.ends_at > ${at(since)}
      ),
      -- The issuance that used up the allowance: the first to reach the plan limit plus the
      -- extra invoices allowed at that moment.
      hits as (
        select distinct on (r.id) r.id, r.user_id, r.starts_at, r.ends_at,
               r.invoice_limit, r.extra, r.issued_at as hit_at, r.usage_period_id as hit_period_id
        from ranked r
        where r.n >= r.invoice_limit + r.extra
        order by r.id, r.n
      )
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
