import { type SQL, sql } from "@billsafi/db";
import { INACTIVE_AFTER_DAYS, PRO_ENDING_WITHIN_DAYS } from "@billsafi/domain";
import { at } from "./admin-sql.js";

/*
 * The account statuses from @billsafi/domain (account-status.ts) as SQL, so the tenants
 * directory can filter, sort and page on them. Every admin page that shows a status or
 * "last meaningful activity" uses these, and the admin e2e suite checks they agree with
 * the domain functions, including the Pro rule (proPeriodAt).
 */

/**
 * End of the latest run of paid months, or null with none paid. Same as the domain's
 * addNairobiMonths: Postgres adds months to the Nairobi wall-clock time and clamps a
 * missing day to the month's last day, keeping the anchor day for longer runs.
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
    when ${proAccess} and ${proEndsAt} <= ${at(now)} + make_interval(days => ${PRO_ENDING_WITHIN_DAYS})
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
  const cutoff = sql`${at(now)} - make_interval(days => ${INACTIVE_AFTER_DAYS})`;
  return sql<string>`(case
    when ${facts.proAccess} then 'subscribed'
    when ${facts.readyInvoices} > 0
      and (${facts.lastActivityAt} is null or ${facts.lastActivityAt} < ${cutoff}) then 'inactive'
    when ${facts.readyInvoices} > 0 then 'activated'
    when ${facts.businesses} > 0 then 'onboarding'
    else 'registered'
  end)`;
}
