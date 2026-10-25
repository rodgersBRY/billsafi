import { Inject, Injectable } from "@nestjs/common";
import {
  type AdminFunnel,
  type AdminFunnelDays,
  type AdminFunnelStepKey,
  type AdminOverview,
  type AdminRetention,
  type AdminRetentionWeeks,
  type AdminSignupCounts,
  adminFunnelSteps,
} from "@billsafi/contracts";
import { type DatabaseConnection, type SQL, sql } from "@billsafi/db";
import {
  nairobiCalendarMonth,
  nairobiDate,
  nairobiDayStart,
  nairobiWeekStart,
  PRO_PLAN,
  money,
} from "@billsafi/domain";
import { DATABASE } from "../database/database.module.js";
import { at, DAY_MS, fromUtc, hasGoogle, ratio, selectRows, utcAt } from "./admin-sql.js";

const WEEK_MS = 7 * DAY_MS;

type Count = { total: number; google: number };

/** Read-only aggregates for the overview, funnel and retention tabs. */
@Injectable()
export class AdminMetricsService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  private rows<T>(query: SQL): Promise<T[]> {
    return selectRows<T>(this.connection.db, query);
  }

  async overview(now = new Date()): Promise<AdminOverview> {
    const today = nairobiDayStart(now);
    // "Last 7 days" means today plus the six Nairobi days before it.
    const week = new Date(today.getTime() - 6 * DAY_MS);
    // One "last 30 days" for the whole page: today plus the 29 Nairobi days before it.
    const month30 = new Date(today.getTime() - 29 * DAY_MS);
    const month = nairobiCalendarMonth(now);

    // Signups per window, split by whether the account has a Google login.
    const [signups] = await this.rows<{
      today: Count;
      week: Count;
      month: Count;
    }>(sql`
      with recent as (
        select ${fromUtc(sql`u.created_at`)} as signed_up_at, ${hasGoogle(sql`u.id`)} as google
        from users u
        where u.created_at >= ${utcAt(month30)} and u.created_at < ${utcAt(now)}
      )
      select
        json_build_object('total', count(*) filter (where signed_up_at >= ${at(today)}),
                          'google', count(*) filter (where signed_up_at >= ${at(today)} and google)) as today,
        json_build_object('total', count(*) filter (where signed_up_at >= ${at(week)}),
                          'google', count(*) filter (where signed_up_at >= ${at(week)} and google)) as week,
        json_build_object('total', count(*), 'google', count(*) filter (where google)) as month
      from recent
    `);

    const [activity] = await this.rows<{
      activeBusinesses: number;
      invoicesCreated: number;
      invoicesReady: number;
      totalAccounts: number;
      convertedAccounts: number;
      kesCollected: string;
      succeeded30: number;
      failed30: number;
    }>(sql`
      select
        -- Active business: at least one invoice made Ready in the last 30 days.
        (select count(distinct business_id) from invoice_issuances
          where issued_at >= ${at(month30)} and issued_at < ${at(now)})::int as "activeBusinesses",
        (select count(*) from invoices
          where created_at >= ${at(month.start)} and created_at < ${at(month.end)})::int as "invoicesCreated",
        (select count(*) from invoice_issuances
          where issued_at >= ${at(month.start)} and issued_at < ${at(month.end)})::int as "invoicesReady",
        (select count(*) from users)::int as "totalAccounts",
        -- Conversion counts any succeeded plan payment, Pro month or credit pack.
        (select count(distinct user_id) from subscription_payments
          where status = 'succeeded')::int as "convertedAccounts",
        (select coalesce(sum(amount), 0)::numeric(14,2)::text from subscription_payments
          where status = 'succeeded'
            and confirmed_at >= ${at(month.start)} and confirmed_at < ${at(month.end)}) as "kesCollected",
        -- Success rate is by checkout time; pending payments are left out.
        (select count(*) from subscription_payments
          where status = 'succeeded'
            and created_at >= ${at(month30)} and created_at < ${at(now)})::int as "succeeded30",
        (select count(*) from subscription_payments
          where status = 'failed'
            and created_at >= ${at(month30)} and created_at < ${at(now)})::int as "failed30"
    `);

    const paying = await this.payingAccounts(now);
    const a = activity!;
    const counts = (count: Count): AdminSignupCounts => ({
      total: Number(count.total),
      google: Number(count.google),
      email: Number(count.total) - Number(count.google),
    });
    return {
      signups: {
        today: counts(signups!.today),
        last7Days: counts(signups!.week),
        last30Days: counts(signups!.month),
      },
      activeBusinesses: a.activeBusinesses,
      invoicesCreatedThisMonth: a.invoicesCreated,
      invoicesReadyThisMonth: a.invoicesReady,
      totalAccounts: a.totalAccounts,
      payingAccounts: paying,
      conversion: ratio(a.convertedAccounts, a.totalAccounts),
      mrrUsd: money(PRO_PLAN.priceUsd).times(paying).toFixed(2),
      kesCollectedThisMonth: a.kesCollected,
      mpesaSuccessRate30Days: ratio(a.succeeded30, a.succeeded30 + a.failed30),
      generatedAt: now.toISOString(),
    };
  }

  /** Accounts with Pro access now: anchor <= now < paid_until, as proPeriodAt decides. */
  private async payingAccounts(now: Date): Promise<number> {
    const [row] = await this.rows<{ total: number }>(sql`
      select count(*)::int as total from subscriptions
      where anchor_at <= ${at(now)} and paid_until > ${at(now)}
    `);
    return row!.total;
  }

  /**
   * For users who signed up in the last `days` days: how many reached each
   * step at least once, and the median time from signup to their first time.
   */
  async funnel(days: AdminFunnelDays, now = new Date()): Promise<AdminFunnel> {
    const since = new Date(nairobiDayStart(now).getTime() - (days - 1) * DAY_MS);
    // Medians use percentile_cont, which skips users who never reached the step.
    const median = (column: string) =>
      sql`percentile_cont(0.5) within group (
        order by extract(epoch from ${sql.identifier(column)} - signed_up_at)
      )`;

    const [row] = await this.rows<Record<string, number | null>>(sql`
      with cohort as (
        select u.id, ${fromUtc(sql`u.created_at`)} as signed_up_at
        from users u
        where u.created_at >= ${utcAt(since)} and u.created_at < ${utcAt(now)}
      ),
      -- Each step is the first such row on the user's own businesses, found
      -- through the owner and business indexes rather than a scan per user.
      firsts as (
        select
          c.signed_up_at,
          c.signed_up_at as signed_up,
          (select min(b.created_at) from businesses b
            where b.owner_user_id = c.id) as business_created,
          (select min(cl.created_at) from businesses b
            join clients cl on cl.business_id = b.id
            where b.owner_user_id = c.id) as client_added,
          (select min(i.created_at) from businesses b
            join invoices i on i.business_id = b.id
            where b.owner_user_id = c.id) as invoice_created,
          (select min(ii.issued_at) from invoice_issuances ii
            where ii.user_id = c.id) as invoice_ready,
          (select min(p.created_at) from businesses b
            join invoice_payments p on p.business_id = b.id
            where b.owner_user_id = c.id) as payment_recorded
        from cohort c
      )
      select
        ${sql.join(
          adminFunnelSteps.map(
            (step) =>
              sql`count(${sql.identifier(step)})::int as ${sql.identifier(`${step}_users`)},
                  ${median(step)} as ${sql.identifier(`${step}_median`)}`,
          ),
          sql`, `,
        )}
      from firsts
    `);

    const users = (step: AdminFunnelStepKey) => Number(row![`${step}_users`] ?? 0);
    const signups = users("signed_up");
    return {
      days,
      since: since.toISOString(),
      steps: adminFunnelSteps.map((key, index) => {
        const count = users(key);
        const previous = index > 0 ? users(adminFunnelSteps[index - 1]!) : null;
        const medianSeconds = row![`${key}_median`];
        return {
          key,
          users: count,
          shareOfSignups: ratio(count, signups),
          dropFromPrevious:
            previous && previous > 0 ? Math.round((1 - count / previous) * 10_000) / 10_000 : null,
          medianSecondsFromSignup:
            medianSeconds === null ? null : Math.round(Number(medianSeconds)),
        };
      }),
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Weekly signup cohorts (Monday start, Nairobi). For each cohort and each
   * week since, the share of its users who made at least one invoice Ready.
   */
  async retention(weeks: AdminRetentionWeeks, now = new Date()): Promise<AdminRetention> {
    const first = new Date(nairobiWeekStart(now).getTime() - (weeks - 1) * WEEK_MS);
    // Nairobi has no daylight saving, so weeks are exact 7-day steps from `first`.
    const weekIndex = (expr: SQL) =>
      sql`floor(extract(epoch from ${expr} - ${at(first)}) / ${WEEK_MS / 1000})::int`;

    const rows = await this.rows<{ cohort: number; week: number | null; users: number }>(sql`
      with cohort as (
        select u.id, ${weekIndex(fromUtc(sql`u.created_at`))} as cohort
        from users u
        where u.created_at >= ${utcAt(first)} and u.created_at < ${utcAt(now)}
      ),
      active as (
        select distinct c.cohort, ii.user_id, ${weekIndex(sql`ii.issued_at`)} as week
        from invoice_issuances ii join cohort c on c.id = ii.user_id
        where ii.issued_at >= ${at(first)} and ii.issued_at < ${at(now)}
      )
      -- Cohort sizes come back with week null; active counts per week follow.
      select cohort, null::int as week, count(*)::int as users from cohort group by cohort
      union all
      select cohort, week, count(*)::int as users from active group by cohort, week
    `);

    const sizes = new Map<number, number>();
    const active = new Map<string, number>();
    for (const row of rows) {
      if (row.week === null) sizes.set(row.cohort, row.users);
      else active.set(`${row.cohort}:${row.week}`, row.users);
    }

    return {
      weeks,
      cohorts: Array.from({ length: weeks }, (_, cohort) => {
        const size = sizes.get(cohort) ?? 0;
        return {
          weekStart: nairobiDate(new Date(first.getTime() + cohort * WEEK_MS)),
          users: size,
          // From the signup week through the current week (index weeks - 1).
          activeShare: Array.from({ length: weeks - cohort }, (_, offset) =>
            ratio(active.get(`${cohort}:${cohort + offset}`) ?? 0, size),
          ),
        };
      }),
      generatedAt: now.toISOString(),
    };
  }
}
