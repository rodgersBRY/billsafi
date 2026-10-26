import { Inject, Injectable } from "@nestjs/common";
import {
  type AdminFunnel,
  type AdminFunnelDays,
  type AdminFunnelStepKey,
  type AdminRetention,
  type AdminRetentionWeeks,
  adminFunnelSteps,
} from "@billsafi/contracts";
import { type DatabaseConnection, type SQL, sql } from "@billsafi/db";
import { nairobiDate, nairobiDayStart, nairobiWeekStart } from "@billsafi/domain";
import { DATABASE } from "../../database/database.module.js";
import { at, DAY_MS, fromUtc, ratio, selectRows, utcAt } from "../shared/admin-sql.js";

const WEEK_MS = 7 * DAY_MS;
/** Read-only aggregates for the funnel and retention tabs (the overview has its own service). */
@Injectable()
export class AdminMetricsService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  private rows<T>(query: SQL): Promise<T[]> {
    return selectRows<T>(this.connection.db, query);
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
