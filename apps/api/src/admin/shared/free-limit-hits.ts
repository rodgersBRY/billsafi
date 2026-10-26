import { type SQL, sql } from "@billsafi/db";
import { FREE_PLAN } from "@billsafi/domain";
import { at } from "./admin-sql.js";

/**
 * The `ranked` and `hits` CTEs behind "Free accounts that used their whole allowance":
 * Free months, ended after `since`, in which the account made its limit-th plan-funded
 * invoice Ready, the limit being the plan's plus any override extra in force at that
 * moment. Every plan-funded invoice in the month's window counts towards the limit, Pro
 * ones included (D044), but a hit is only real when that limit-th invoice was charged to
 * the Free period (`hit_period_id = id`): if it went to a Pro period, the account had
 * already upgraded. Each caller bounds `hit_at` itself. One row per Free month and account.
 */
export function freeLimitHitsCte(since: Date): SQL {
  return sql`
    ranked as (
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
    )`;
}
