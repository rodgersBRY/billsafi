import { Inject, Injectable } from "@nestjs/common";
import {
  type AdminAttention,
  type AdminOverview,
  type AdminRange,
  type AdminSubscriptionMix,
  type AdminTrends,
  REPEATED_FAILED_SIGN_INS,
} from "@billsafi/contracts";
import { type DatabaseConnection, type SQL, sql } from "@billsafi/db";
import {
  addNairobiMonths,
  nairobiCalendarMonth,
  nairobiDayStart,
  PRO_PLAN,
  money,
  stuckPaymentCutoff,
} from "@billsafi/domain";
import { DATABASE } from "../../database/database.module.js";
import { activeOverrideSql, currentMonthSourceSql, proAccessSql } from "../shared/account-sql.js";
import {
  at,
  DAY_MS,
  fromUtc,
  hasGoogle,
  paidOnSql,
  ratio,
  selectRows,
  utcAt,
} from "../shared/admin-sql.js";
import { freeLimitHitsCte, realFreeLimitHit } from "../shared/free-limit-hits.js";
import { activationCounts } from "./activation.js";
import { proAccessCte } from "./pro-access.js";
import { bucketIndexSql, bucketsSql, planRange, type RangePlan } from "./range.js";

const WEEK_MS = 7 * DAY_MS;

const MANUAL = "manual";
const ENDING_DAYS = 7;
const LAPSED_DAYS = 30;

/** What one window [from, to) holds, counted the same way for the range and the one before. */
interface WindowFacts {
  signups: number;
  google: number;
  active: number;
  ready: number;
  kes: string;
  usd: string;
  succeeded: number;
  failed: number;
  pdfFailed: number;
  emailFailed: number;
  jobsFailed: number;
}

interface ProSnapshots {
  payingNow: number;
  complimentaryNow: number;
  payingStart: number;
  complimentaryStart: number;
  baseCurrent: number;
  churnedCurrent: number;
  basePrevious: number;
  churnedPrevious: number;
}

const usd = (paying: number) => money(PRO_PLAN.priceUsd).times(paying).toFixed(2);
const pair = <T>(current: T, previous: T) => ({ current, previous });
const rate = (count: number, base: number) => ({ rate: ratio(count, base), count, base });

/** Overview tiles, trend series and the attention counts, all over one date range. */
@Injectable()
export class AdminOverviewService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  private get db() {
    return this.connection.db;
  }

  private rows<T>(query: SQL): Promise<T[]> {
    return selectRows<T>(this.db, query);
  }

  private async windowFacts(from: Date, to: Date): Promise<WindowFacts> {
    const users = sql`u.created_at >= ${utcAt(from)} and u.created_at < ${utcAt(to)}`;
    const inWindow = (column: string) =>
      sql`${sql.raw(column)} >= ${at(from)} and ${sql.raw(column)} < ${at(to)}`;
    // Money by the day it was paid: a manual payment's paid_at, else the confirmation.
    const paidIn = sql`${paidOnSql("sp")} >= ${at(from)} and ${paidOnSql("sp")} < ${at(to)}`;
    const [row] = await this.rows<WindowFacts>(sql`
      select
        (select count(*) from users u where ${users})::int as signups,
        (select count(*) from users u where ${users} and ${hasGoogle(sql`u.id`)})::int as google,
        -- Meaningful actions: an invoice created, an invoice made Ready, a payment recorded or a client added.
        (select count(*) from (
          select b.owner_user_id from invoices i join businesses b on b.id = i.business_id
            where ${inWindow("i.created_at")}
          union select ii.user_id from invoice_issuances ii where ${inWindow("ii.issued_at")}
          union select b.owner_user_id from invoice_payments p join businesses b on b.id = p.business_id
            where ${inWindow("p.created_at")}
          union select b.owner_user_id from clients c join businesses b on b.id = c.business_id
            where ${inWindow("c.created_at")}
        ) active)::int as active,
        (select count(*) from invoice_issuances where ${inWindow("issued_at")})::int as ready,
        (select coalesce(sum(sp.amount), 0)::numeric(14,2)::text from subscription_payments sp
          where sp.status = 'succeeded' and sp.currency = 'KES' and ${paidIn}) as kes,
        -- USD is only ever taken by hand; it is reported apart, never converted.
        (select coalesce(sum(sp.amount), 0)::numeric(14,2)::text from subscription_payments sp
          where sp.status = 'succeeded' and sp.currency = 'USD' and ${paidIn}) as usd,
        -- Checkouts by the time they started, M-Pesa only; pending ones are left out.
        (select count(*) from subscription_payments
          where status = 'succeeded' and provider <> ${MANUAL} and ${inWindow("created_at")})::int as succeeded,
        (select count(*) from subscription_payments
          where status = 'failed' and provider <> ${MANUAL} and ${inWindow("created_at")})::int as failed,
        -- Recorded operation failures in the window (D066).
        (select count(*) from operation_failures
          where kind = 'pdf' and ${inWindow("created_at")})::int as "pdfFailed",
        (select count(*) from operation_failures
          where kind = 'email' and ${inWindow("created_at")})::int as "emailFailed",
        (select count(*) from operation_failures
          where kind = 'job' and ${inWindow("created_at")})::int as "jobsFailed"
    `);
    return row!;
  }

  /** Pro accounts now and at the range start, and who lost Pro inside each period. */
  private async proSnapshots(plan: RangePlan): Promise<ProSnapshots> {
    const [row] = await this.rows<ProSnapshots>(sql`
      with ${proAccessCte("now_set", plan.end)},
        ${proAccessCte("start_set", plan.start)},
        ${proAccessCte("previous_set", plan.previousStart)}
      select
        (select count(*) from now_set where source = 'paid')::int as "payingNow",
        (select count(*) from now_set where source = 'complimentary')::int as "complimentaryNow",
        (select count(*) from start_set where source = 'paid')::int as "payingStart",
        (select count(*) from start_set where source = 'complimentary')::int as "complimentaryStart",
        -- Pro at the start of the range that is gone by its end: churn.
        (select count(*) from start_set)::int as "baseCurrent",
        (select count(*) from start_set s
          where not exists (select 1 from now_set n where n.user_id = s.user_id))::int as "churnedCurrent",
        (select count(*) from previous_set)::int as "basePrevious",
        (select count(*) from previous_set p
          where not exists (select 1 from start_set s where s.user_id = p.user_id))::int as "churnedPrevious"
    `);
    return row!;
  }

  private async totalAccounts(instant: Date): Promise<number> {
    const [row] = await this.rows<{ total: number }>(
      sql`select count(*)::int as total from users where created_at < ${utcAt(instant)}`,
    );
    return row!.total;
  }

  async overview(range: AdminRange, now = new Date()): Promise<AdminOverview> {
    const plan = planRange(range, now);
    const current = await this.windowFacts(plan.start, plan.end);
    const previous = await this.windowFacts(plan.previousStart, plan.previousEnd);
    const pro = await this.proSnapshots(plan);
    const activation = {
      current: await activationCounts(this.db, plan.start, plan.end, now),
      previous: await activationCounts(this.db, plan.previousStart, plan.previousEnd, now),
    };
    const split = (facts: WindowFacts) => ({
      total: facts.signups,
      google: facts.google,
      email: facts.signups - facts.google,
    });
    const mpesa = (facts: WindowFacts) => ({
      succeeded: facts.succeeded,
      failed: facts.failed,
      successRate: ratio(facts.succeeded, facts.succeeded + facts.failed),
    });

    const failedOperations = (facts: WindowFacts) => ({
      total: facts.failed + facts.pdfFailed + facts.emailFailed + facts.jobsFailed,
      mpesa: facts.failed,
      pdf: facts.pdfFailed,
      email: facts.emailFailed,
      jobs: facts.jobsFailed,
    });

    return {
      range,
      period: { start: plan.start.toISOString(), end: plan.end.toISOString() },
      previousPeriod: {
        start: plan.previousStart.toISOString(),
        end: plan.previousEnd.toISOString(),
      },
      totalAccounts: pair(await this.totalAccounts(plan.end), await this.totalAccounts(plan.start)),
      signups: pair(split(current), split(previous)),
      activeAccounts: pair(current.active, previous.active),
      payingAccounts: pair(pro.payingNow, pro.payingStart),
      complimentaryProAccounts: pair(pro.complimentaryNow, pro.complimentaryStart),
      mrrUsd: pair(usd(pro.payingNow), usd(pro.payingStart)),
      proChurn: pair(
        rate(pro.churnedCurrent, pro.baseCurrent),
        rate(pro.churnedPrevious, pro.basePrevious),
      ),
      invoicesReady: pair(current.ready, previous.ready),
      collected: {
        kes: pair(current.kes, previous.kes),
        usd: pair(current.usd, previous.usd),
      },
      mpesa: pair(mpesa(current), mpesa(previous)),
      failedOperations: pair(failedOperations(current), failedOperations(previous)),
      activation: pair(
        rate(activation.current.activated, activation.current.base),
        rate(activation.previous.activated, activation.previous.base),
      ),
      attention: await this.attention(now),
      definitions: definitions(),
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Counts that equal the totals of the matching directory queries (see
   * adminAttentionSchema), using the same predicates as those directories.
   */
  async attention(now: Date): Promise<AdminAttention> {
    const soon = sql`${at(now)} + make_interval(hours => ${24 * ENDING_DAYS})`;
    const monthStart = nairobiCalendarMonth(now).start;
    const todayStart = nairobiDayStart(now);
    const hourly = REPEATED_FAILED_SIGN_INS;
    const [row] = await this.rows<
      Omit<AdminAttention, "freeLimitReached" | "failedOperationsToday" | "repeatedFailedSignIns">
    >(sql`
      select
        (select count(*) from subscription_payments
          where status = 'pending' and created_at < ${at(stuckPaymentCutoff(now))})::int as "stuckPayments",
        (select count(*) from users where banned)::int as "suspendedAccounts",
        (select count(*) from subscriptions s
          where ${proAccessSql(sql`s.anchor_at`, sql`s.paid_until`, now)} and s.paid_until <= ${soon})::int as "proEnding",
        (select count(*) from subscriptions s
          where s.paid_until <= ${at(now)}
            and s.paid_until > ${at(now)} - make_interval(hours => ${24 * LAPSED_DAYS}))::int as "proLapsed",
        (select count(*) from allowance_overrides o
          where ${activeOverrideSql(sql`o`, now)} and o.expires_at <= ${soon})::int as "overridesEnding"
    `);
    const [limit] = await this.rows<{ total: number }>(sql`
      with ${freeLimitHitsCte(monthStart)}
      select count(*)::int as total from hits h
      where ${realFreeLimitHit(monthStart, now)}
    `);
    // Failures since Nairobi midnight: recorded PDF, email and job failures, plus M-Pesa checkouts.
    const [today] = await this.rows<{ total: number }>(sql`
      select (
        (select count(*) from operation_failures
          where created_at >= ${at(todayStart)} and created_at <= ${at(now)})
        + (select count(*) from subscription_payments
          where status = 'failed' and provider <> ${MANUAL}
            and created_at >= ${at(todayStart)} and created_at <= ${at(now)})
      )::int as total
    `);
    // Emails with this many failed sign-ins inside one clock hour, in the last 24 hours.
    const [repeated] = await this.rows<{ total: number }>(sql`
      select count(distinct email)::int as total from (
        select email from failed_sign_ins
        where email is not null
          and created_at >= ${at(new Date(now.getTime() - DAY_MS))} and created_at <= ${at(now)}
        group by email, date_trunc('hour', created_at at time zone 'UTC')
        having count(*) >= ${hourly}
      ) hammered
    `);
    return {
      ...row!,
      freeLimitReached: limit!.total,
      failedOperationsToday: today!.total,
      repeatedFailedSignIns: repeated!.total,
    };
  }

  /** The instant each bucket ends: where the next one starts, and now for the last. */
  private bucketEnds(plan: RangePlan): Date[] {
    return Array.from({ length: plan.bucketCount }, (_, i) => {
      if (i === plan.bucketCount - 1) return plan.end;
      if (plan.bucket === "month") return addNairobiMonths(plan.origin, i + 1);
      const size = plan.bucket === "week" ? WEEK_MS : DAY_MS;
      return new Date(plan.origin.getTime() + (i + 1) * size);
    });
  }

  /** Paying accounts at the end of every bucket, by the same Pro-at-time rule as the Overview. */
  private async payingAtBucketEnds(plan: RangePlan): Promise<number[]> {
    const ends = this.bucketEnds(plan);
    const ctes = ends.map((end, i) => proAccessCte(`pro_${i}`, end));
    const counts = ends.map(
      (_, i) =>
        sql`select ${i}::int as i, count(*)::int as n from ${sql.identifier(`pro_${i}`)} where source = 'paid'`,
    );
    const rows = await this.rows<{ i: number; n: number }>(
      sql`with ${sql.join(ctes, sql`, `)} ${sql.join(counts, sql` union all `)}`,
    );
    const paying = new Array<number>(ends.length).fill(0);
    for (const row of rows) paying[Number(row.i)] = Number(row.n);
    return paying;
  }

  async trends(range: AdminRange, now = new Date()): Promise<AdminTrends> {
    const plan = planRange(range, now);
    const bounded = (column: SQL) =>
      sql`${column} >= ${at(plan.start)} and ${column} < ${at(plan.end)}`;
    const perBucket = (instant: SQL) => bucketIndexSql(plan, instant);
    const paidAt = paidOnSql("sp");
    const rows = await this.rows<{
      bucketStart: string;
      signups: number;
      accountsTotal: number;
      firstInvoices: number;
      invoicesReady: number;
      kesCollected: string;
      usdCollected: string;
      activeAccounts: number;
      pdfApp: number;
      pdfPublicLink: number;
      linkOpens: number;
    }>(sql`
      with b as (${bucketsSql(plan)}),
      signups as (
        select ${perBucket(fromUtc(sql`u.created_at`))} as i, count(*)::int as n from users u
        where u.created_at >= ${utcAt(plan.start)} and u.created_at < ${utcAt(plan.end)} group by 1
      ),
      firsts as (
        select ${perBucket(sql`f.first_at`)} as i, count(*)::int as n from (
          select min(issued_at) as first_at from invoice_issuances group by user_id
        ) f where ${bounded(sql`f.first_at`)} group by 1
      ),
      ready as (
        select ${perBucket(sql`ii.issued_at`)} as i, count(*)::int as n from invoice_issuances ii
        where ${bounded(sql`ii.issued_at`)} group by 1
      ),
      paid as (
        select ${perBucket(paidAt)} as i,
          coalesce(sum(sp.amount) filter (where sp.currency = 'KES'), 0)::numeric(14,2)::text as kes,
          coalesce(sum(sp.amount) filter (where sp.currency = 'USD'), 0)::numeric(14,2)::text as usd
        from subscription_payments sp
        where sp.status = 'succeeded' and ${bounded(paidAt)} group by 1
      ),
      actions as (
        select ${perBucket(sql`i.created_at`)} as i, bz.owner_user_id as uid
          from invoices i join businesses bz on bz.id = i.business_id where ${bounded(sql`i.created_at`)}
        union all select ${perBucket(sql`ii.issued_at`)}, ii.user_id
          from invoice_issuances ii where ${bounded(sql`ii.issued_at`)}
        union all select ${perBucket(sql`p.created_at`)}, bz.owner_user_id
          from invoice_payments p join businesses bz on bz.id = p.business_id
          where ${bounded(sql`p.created_at`)}
        union all select ${perBucket(sql`c.created_at`)}, bz.owner_user_id
          from clients c join businesses bz on bz.id = c.business_id where ${bounded(sql`c.created_at`)}
      ),
      active as (select i, count(distinct uid)::int as n from actions group by i),
      pdfs as (
        select ${perBucket(sql`pe.created_at`)} as i,
          (count(*) filter (where pe.props ->> 'source' = 'app'))::int as app,
          (count(*) filter (where pe.props ->> 'source' = 'public_link'))::int as "publicLink"
        from product_events pe
        where pe.name = 'pdf_downloaded' and ${bounded(sql`pe.created_at`)} group by 1
      ),
      opens as (
        select ${perBucket(sql`pe.created_at`)} as i, count(*)::int as n from product_events pe
        where pe.name = 'link_opened' and ${bounded(sql`pe.created_at`)} group by 1
      ),
      before as (select count(*)::int as n from users where created_at < ${utcAt(plan.start)})
      select
        to_char(b.bucket_start at time zone 'Africa/Nairobi', 'YYYY-MM-DD') as "bucketStart",
        coalesce(signups.n, 0) as signups,
        ((select n from before) + sum(coalesce(signups.n, 0)) over (order by b.i))::int as "accountsTotal",
        coalesce(firsts.n, 0) as "firstInvoices",
        coalesce(ready.n, 0) as "invoicesReady",
        coalesce(paid.kes, '0.00') as "kesCollected",
        coalesce(paid.usd, '0.00') as "usdCollected",
        coalesce(active.n, 0) as "activeAccounts",
        coalesce(pdfs.app, 0) as "pdfApp",
        coalesce(pdfs."publicLink", 0) as "pdfPublicLink",
        coalesce(opens.n, 0) as "linkOpens"
      from b
      left join signups on signups.i = b.i
      left join firsts on firsts.i = b.i
      left join ready on ready.i = b.i
      left join paid on paid.i = b.i
      left join active on active.i = b.i
      left join pdfs on pdfs.i = b.i
      left join opens on opens.i = b.i
      order by b.i
    `);
    const paying = await this.payingAtBucketEnds(plan);
    return {
      range,
      bucketSize: plan.bucket,
      period: { start: plan.start.toISOString(), end: plan.end.toISOString() },
      points: rows.map(({ pdfApp, pdfPublicLink, ...row }, index) => ({
        ...row,
        pdfDownloads: { app: Number(pdfApp), publicLink: Number(pdfPublicLink) },
        linkOpens: Number(row.linkOpens),
        activeAccounts: Number(row.activeAccounts),
        mrrUsd: usd(paying[index] ?? 0),
        signups: Number(row.signups),
        accountsTotal: Number(row.accountsTotal),
        firstInvoices: Number(row.firstInvoices),
        invoicesReady: Number(row.invoicesReady),
      })),
      subscriptionMix: await this.subscriptionMix(now),
      generatedAt: now.toISOString(),
    };
  }

  /** Every account now, in parts that add up to the total. */
  private async subscriptionMix(now: Date): Promise<AdminSubscriptionMix> {
    const access = proAccessSql(sql`s.anchor_at`, sql`s.paid_until`, now);
    const soon = sql`${at(now)} + make_interval(hours => ${24 * ENDING_DAYS})`;
    const [row] = await this.rows<AdminSubscriptionMix>(sql`
      with accounts as (
        select ${access} as pro, s.paid_until,
          ${currentMonthSourceSql(sql`u.id`, access, now)} as source
        from users u left join subscriptions s on s.user_id = u.id
        where u.created_at < ${utcAt(now)}
      )
      select
        count(*)::int as total,
        count(*) filter (where pro and paid_until <= ${soon})::int as "proEnding",
        count(*) filter (where pro and paid_until > ${soon} and source = 'paid')::int as "proPaid",
        count(*) filter (where pro and paid_until > ${soon} and source = 'complimentary')::int
          as "proComplimentary",
        count(*) filter (where not coalesce(pro, false) and paid_until <= ${at(now)}
          and paid_until > ${at(now)} - make_interval(hours => ${24 * LAPSED_DAYS}))::int as lapsed
      from accounts
    `);
    const mix = row!;
    return {
      ...mix,
      free: mix.total - mix.proEnding - mix.proPaid - mix.proComplimentary - mix.lapsed,
    };
  }
}

function definitions(): AdminOverview["definitions"] {
  return {
    totalAccounts:
      "All accounts that exist at the end of the range, and at its start for the comparison.",
    signups:
      "Accounts created in the range. Google means the account has a Google login, email means it does not.",
    activeAccounts:
      "Accounts that did at least one meaningful thing in the range: created an invoice, made an invoice Ready, recorded a payment or added a client.",
    payingAccounts:
      "Accounts with Pro access whose current Pro month was paid for, now and at the start of the range.",
    complimentaryProAccounts:
      "Accounts with Pro access whose current Pro month was a gift. They never count as revenue.",
    mrrUsd:
      "Paying accounts times the Pro price in USD. Gifted Pro months are left out. It is not converted from KES.",
    proChurn:
      "Of the accounts with Pro at the start of the range, the share that had no Pro at the end of it. Ending Pro by hand counts as churn. A lapse that renewed before the end does not. Gifted Pro is included. Pro history comes from the payments and gifts that covered each moment.",
    invoicesReady:
      "Invoices made Ready in the range. Each invoice is counted once, the first time.",
    collected:
      "Plan payments that succeeded, by the day they were paid, including payments recorded by hand. KES and USD are never added together.",
    mpesa:
      "M-Pesa plan checkouts that succeeded or failed in the range, by the time they started. Pending checkouts are not counted.",
    failedOperations:
      "Failed M-Pesa checkouts (by the time they started) plus the PDF, email and background job failures BillSafi recorded in the range. Recording began with phase 5, so earlier periods count M-Pesa only.",
    activation:
      "Of the accounts that signed up in the range, the share that made an invoice Ready within 7 days of signing up. Accounts younger than 7 days are left out until their week is over.",
  };
}
