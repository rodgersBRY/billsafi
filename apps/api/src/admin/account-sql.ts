import { type SQL, sql } from "@billsafi/db";
import { INACTIVE_AFTER_DAYS, PRO_ENDING_WITHIN_DAYS } from "@billsafi/domain";
import { at } from "./admin-sql.js";

/*
 * The account statuses from @billsafi/domain (account-status.ts) as SQL, so the tenants
 * directory can filter, sort and page on them. Every admin page that shows a status or
 * "last meaningful activity" uses these, and the admin e2e suite checks they agree with
 * the domain functions, including the Pro rule (proPeriodAt). The Pro end date comes from
 * `subscriptions.paid_until`, written by BillingService with addNairobiMonths.
 *
 * Day windows are written as hours (24 * N): with a daylight-saving session time zone,
 * "N days" on a timestamptz would follow the wall clock and shift the window by an hour.
 */

/**
 * End of the latest run of paid months, or null with none paid. Same as the domain's
 * addNairobiMonths: Postgres adds months to the Nairobi wall-clock time and clamps a
 * missing day to the month's last day, keeping the anchor day for longer runs.
 *
 * Admin queries read the stored `subscriptions.paid_until` instead, which only billing
 * writes. This is the expression migration 0010 backfilled that column with, kept so the
 * e2e suite keeps proving it matches the domain function.
 */
export function proEndsAtSql(anchorAt: SQL, paidMonths: SQL): SQL {
  return sql`case when ${anchorAt} is not null and ${paidMonths} > 0 then
    ((${anchorAt} at time zone 'Africa/Nairobi') + make_interval(months => ${paidMonths}))
      at time zone 'Africa/Nairobi'
  end`;
}

/** Pro access at `now`: proPeriodAt finds a period when anchor <= now < end. */
export function proAccessSql(anchorAt: SQL, proEndsAt: SQL, now: Date): SQL<boolean> {
  return sql<boolean>`(${proEndsAt} is not null and ${anchorAt} <= ${at(now)} and ${proEndsAt} > ${at(now)})`;
}

/**
 * Latest meaningful action on the account: an invoice created, an invoice made Ready, a
 * payment recorded or a client added, across all of its businesses. Null when none.
 */
export function lastMeaningfulActivitySql(userId: SQL): SQL {
  return sql`greatest(
    (select max(i.created_at) from businesses b join invoices i on i.business_id = b.id
      where b.owner_user_id = ${userId}),
    (select max(ii.issued_at) from invoice_issuances ii where ii.user_id = ${userId}),
    (select max(p.created_at) from businesses b join invoice_payments p on p.business_id = b.id
      where b.owner_user_id = ${userId}),
    (select max(c.created_at) from businesses b join clients c on c.business_id = b.id
      where b.owner_user_id = ${userId})
  )`;
}

export function accountStatusSql(banned: SQL): SQL<string> {
  return sql<string>`(case when ${banned} then 'suspended' else 'active' end)`;
}

export function subscriptionStatusSql(proAccess: SQL, proEndsAt: SQL, now: Date): SQL<string> {
  return sql<string>`(case
    when ${proAccess} and ${proEndsAt} <= ${at(now)} + make_interval(hours => ${24 * PRO_ENDING_WITHIN_DAYS})
      then 'pro_ending'
    when ${proAccess} then 'pro'
    when ${proEndsAt} is not null and ${proEndsAt} <= ${at(now)} then 'lapsed'
    else 'free'
  end)`;
}

/** First match wins: subscribed > inactive > activated > onboarding > registered. */
export function lifecycleStageSql(
  facts: { proAccess: SQL; businesses: SQL; readyInvoices: SQL; lastActivityAt: SQL },
  now: Date,
): SQL<string> {
  const cutoff = sql`${at(now)} - make_interval(hours => ${24 * INACTIVE_AFTER_DAYS})`;
  return sql<string>`(case
    when ${facts.proAccess} then 'subscribed'
    when ${facts.readyInvoices} > 0
      and (${facts.lastActivityAt} is null or ${facts.lastActivityAt} < ${cutoff}) then 'inactive'
    when ${facts.readyInvoices} > 0 then 'activated'
    when ${facts.businesses} > 0 then 'onboarding'
    else 'registered'
  end)`;
}

/**
 * Who paid for the Pro month in progress: "complimentary" when the latest payment or grant
 * whose window covers `now` is a grant, otherwise "paid" (including Pro with no covering
 * row, which before grants existed could only come from a payment); null off Pro.
 */
export function currentMonthSourceSql(userId: SQL, proAccess: SQL, now: Date): SQL<string | null> {
  return sql<string | null>`(case when ${proAccess} then
    case when (
      select ext.source from (
        select 'paid' as source, coalesce(sp.confirmed_at, sp.created_at) as added_at
        from subscription_payments sp
        where sp.user_id = ${userId} and sp.status = 'succeeded' and sp.purpose = 'pro_month'
          and sp.granted_from <= ${at(now)} and sp.granted_until > ${at(now)}
        union all
        select 'complimentary', g.created_at
        from account_grants g
        where g.user_id = ${userId} and g.kind = 'pro_months'
          and g.granted_from <= ${at(now)} and g.granted_until > ${at(now)}
      ) ext order by ext.added_at desc limit 1
    ) = 'complimentary' then 'complimentary' else 'paid' end
  end)`;
}

/** The credit balance as AllowanceService.credits counts it: bought + granted - used. */
export function creditsSql(userId: SQL): SQL<number> {
  return sql<number>`((select coalesce(sum(sp.credits_granted), 0) from subscription_payments sp
      where sp.user_id = ${userId} and sp.status = 'succeeded')
    + (select coalesce(sum(g.quantity), 0) from account_grants g
      where g.user_id = ${userId} and g.kind = 'invoice_credits')
    - (select count(*) from invoice_issuances ii
      where ii.user_id = ${userId} and ii.source = 'credit'))::int`;
}

/** Overrides counted at `now`, by the same rule as AllowanceService.extraInvoices. */
export function activeOverrideSql(alias: SQL, now: Date): SQL<boolean> {
  return sql<boolean>`(${alias}.revoked_at is null and ${alias}.starts_at <= ${at(now)}
    and ${alias}.expires_at > ${at(now)})`;
}
