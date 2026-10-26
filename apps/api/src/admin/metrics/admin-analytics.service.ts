import { Inject, Injectable } from "@nestjs/common";
import {
  type AdminAnalytics,
  type AdminFeatureKey,
  adminFeatureKeys,
  type AdminRange,
} from "@billsafi/contracts";
import { type DatabaseConnection, type SQL, sql } from "@billsafi/db";
import { addNairobiMonths, nairobiCalendarMonth } from "@billsafi/domain";
import { DATABASE } from "../../database/database.module.js";
import { at, fromUtc, paidOnSql, ratio, selectRows, utcAt } from "../shared/admin-sql.js";
import { freeLimitHitsCte, realFreeLimitHit } from "../shared/free-limit-hits.js";
import { activationCounts } from "./activation.js";
import { bucketIndexSql, bucketsSql, planRange } from "./range.js";

const TOP_ACCOUNTS = 10;
const LIMIT_MONTHS = 6;
const BOUGHT_WITHIN_DAYS = 14;

const round1 = (value: number | string | null) =>
  value === null ? null : Math.round(Number(value) * 10) / 10;

export type AllTime = Pick<AdminAnalytics, "featureAdoption" | "planLimit">;

/** Invoice volume, activation timing, feature adoption, plan limit and top accounts. */
@Injectable()
export class AdminAnalyticsService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  private get db() {
    return this.connection.db;
  }

  private rows<T>(query: SQL): Promise<T[]> {
    return selectRows<T>(this.db, query);
  }

  /** The figures that ignore the range, so the controller can cache them once for every range. */
  async allTime(now = new Date()): Promise<AllTime> {
    const [adoption] = await this.rows<Record<AdminFeatureKey | "base", number>>(sql`
      select
        (select count(distinct owner_user_id) from businesses)::int as base,
        (select count(distinct b.owner_user_id) from invoices i join businesses b on b.id = i.business_id
          where i.discount_type is not null)::int as discount,
        (select count(distinct b.owner_user_id) from invoices i join businesses b on b.id = i.business_id
          where i.tax_rate > 0)::int as tax,
        (select count(distinct owner_user_id) from businesses where logo_key is not null)::int as logo,
        (select count(distinct b.owner_user_id) from business_payment_instructions pi
          join businesses b on b.id = pi.business_id)::int as "paymentInstructions",
        (select count(distinct b.owner_user_id) from invoice_links l
          join businesses b on b.id = l.business_id)::int as "shareLink",
        (select count(distinct b.owner_user_id) from invoice_payments p
          join businesses b on b.id = p.business_id)::int as "paymentRecorded",
        (select count(*) from (select owner_user_id from businesses group by owner_user_id
          having count(*) >= 2) two)::int as "secondBusiness",
        (select count(distinct b.owner_user_id) from businesses b
          where exists (select 1 from accounts a where a.user_id = b.owner_user_id
            and a.provider_id = 'google'))::int as "googleSignIn"
    `);

    const firstMonth = addNairobiMonths(nairobiCalendarMonth(now).start, -(LIMIT_MONTHS - 1));
    const limitMonths = await this.rows<{ month: string; reached: number; bought: number }>(sql`
      with ${freeLimitHitsCte(firstMonth)},
      real_hits as (
        select h.*, exists (
          select 1 from subscription_payments sp
          where sp.user_id = h.user_id and sp.status = 'succeeded'
            and ${paidOnSql("sp")} >= h.hit_at
            and ${paidOnSql("sp")} < h.hit_at
              + make_interval(days => ${BOUGHT_WITHIN_DAYS})
        ) as bought
        from hits h
        where ${realFreeLimitHit(firstMonth, now)}
      ),
      months as (
        select to_char(((${at(firstMonth)} at time zone 'Africa/Nairobi')
          + make_interval(months => m)) , 'YYYY-MM') as month, m
        from generate_series(0, ${LIMIT_MONTHS - 1}::int) as m
      )
      select months.month, count(real_hits.id)::int as reached,
        count(real_hits.id) filter (where real_hits.bought)::int as bought
      from months
      left join real_hits on to_char(real_hits.starts_at at time zone 'Africa/Nairobi', 'YYYY-MM') = months.month
      group by months.month, months.m order by months.m
    `);

    const base = adoption!.base;
    return {
      featureAdoption: {
        base,
        items: adminFeatureKeys.map((key) => ({
          key,
          count: Number(adoption![key]),
          base,
          share: ratio(Number(adoption![key]), base),
        })),
      },
      planLimit: limitMonths.map((row) => ({
        month: row.month,
        reached: Number(row.reached),
        boughtWithin14Days: Number(row.bought),
      })),
    };
  }

  async analytics(range: AdminRange, now = new Date(), allTime?: AllTime): Promise<AdminAnalytics> {
    const plan = planRange(range, now);
    const inRange = (column: SQL) =>
      sql`${column} >= ${at(plan.start)} and ${column} < ${at(plan.end)}`;

    const points = await this.rows<{ bucketStart: string; created: number; ready: number }>(sql`
      with b as (${bucketsSql(plan)}),
      created as (
        select ${bucketIndexSql(plan, sql`i.created_at`)} as i, count(*)::int as n
        from invoices i where ${inRange(sql`i.created_at`)} group by 1
      ),
      ready as (
        select ${bucketIndexSql(plan, sql`ii.issued_at`)} as i, count(*)::int as n
        from invoice_issuances ii where ${inRange(sql`ii.issued_at`)} group by 1
      )
      select to_char(b.bucket_start at time zone 'Africa/Nairobi', 'YYYY-MM-DD') as "bucketStart",
        coalesce(created.n, 0) as created, coalesce(ready.n, 0) as ready
      from b left join created on created.i = b.i left join ready on ready.i = b.i
      order by b.i
    `);

    const [volume] = await this.rows<{ accounts: number; median: string | null }>(sql`
      with per_account as (
        select count(*) as n from invoice_issuances ii
        where ${inRange(sql`ii.issued_at`)} group by ii.user_id
      )
      select count(*)::int as accounts,
        percentile_cont(0.5) within group (order by n) as median
      from per_account
    `);

    const [timing] = await this.rows<{
      signups: number;
      reached: number;
      median: string | null;
      p75: string | null;
    }>(sql`
      with firsts as (
        select ${fromUtc(sql`u.created_at`)} as signed_up_at,
          (select min(ii.issued_at) from invoice_issuances ii where ii.user_id = u.id) as first_at
        from users u
        where u.created_at >= ${utcAt(plan.start)} and u.created_at < ${utcAt(plan.end)}
      ),
      hours as (select extract(epoch from first_at - signed_up_at) / 3600 as h from firsts)
      select (select count(*) from firsts)::int as signups,
        (select count(first_at) from firsts)::int as reached,
        percentile_cont(0.5) within group (order by h) as median,
        percentile_cont(0.75) within group (order by h) as p75
      from hours
    `);
    const activation = await activationCounts(this.db, plan.start, plan.end, now);

    const top = await this.rows<{
      accountId: string;
      name: string;
      email: string;
      readyInvoices: number;
    }>(sql`
      select u.id as "accountId", u.name, u.email, t.n::int as "readyInvoices"
      from (
        select ii.user_id, count(*) as n from invoice_issuances ii
        where ${inRange(sql`ii.issued_at`)} group by ii.user_id
        order by count(*) desc, ii.user_id limit ${TOP_ACCOUNTS}
      ) t join users u on u.id = t.user_id
      order by t.n desc, u.id
    `);

    const { featureAdoption, planLimit } = allTime ?? (await this.allTime(now));
    return {
      range,
      bucketSize: plan.bucket,
      period: { start: plan.start.toISOString(), end: plan.end.toISOString() },
      invoiceVolume: {
        points: points.map((point) => ({
          bucketStart: point.bucketStart,
          created: Number(point.created),
          ready: Number(point.ready),
        })),
        accountsWithReady: volume!.accounts,
        medianReadyPerAccount: round1(volume!.median),
      },
      timeToFirstInvoice: {
        signups: timing!.signups,
        reached: timing!.reached,
        medianHours: round1(timing!.median),
        p75Hours: round1(timing!.p75),
        activation: {
          rate: ratio(activation.activated, activation.base),
          count: activation.activated,
          base: activation.base,
        },
      },
      featureAdoption,
      planLimit,
      topAccounts: top.map((row) => ({ ...row, readyInvoices: Number(row.readyInvoices) })),
      definitions: {
        invoiceVolume:
          "Invoices created and invoices made Ready in each part of the range. The median counts only accounts that made at least one invoice Ready in the range.",
        timeToFirstInvoice:
          "Hours from sign-up to the first invoice made Ready, for accounts that signed up in the range and have reached it so far. The activation rate counts a Ready invoice within 7 days, among sign-ups at least 7 days old.",
        featureAdoption:
          "Of accounts with at least one business, how many have ever used each feature. These are all time figures and do not follow the range.",
        planLimit:
          "Free accounts that used their whole monthly allowance, extra invoices from limit overrides included, in each of the last 6 months. Bought means a Pro or credit payment that succeeded within 14 days of reaching the limit. These figures do not follow the range.",
        topAccounts:
          "The 10 accounts with the most invoices made Ready in the range. Ties are listed by account id.",
      },
      generatedAt: now.toISOString(),
    };
  }
}
