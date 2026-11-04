import { Inject, Injectable } from "@nestjs/common";
import {
  type AdminCheckIns,
  type AdminRange,
  type ReengagementSegment,
  reengagementSegments,
  type ReengagementStep,
  reengagementSteps,
} from "@billsafi/contracts";
import { type DatabaseConnection, type SQL, sql } from "@billsafi/db";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { DATABASE } from "../../database/database.module.js";
import { at, DAY_MS, ratio, selectRows } from "../shared/admin-sql.js";
import { planRange } from "./range.js";

/** A sign-in or action this many days after an email counts as coming back. */
export const CHECK_IN_RETURN_DAYS = 14;

/**
 * Whether the account came back after email `e`: signed in again, created a business, or
 * did a meaningful action, after the email and within the return window. Sign-ins count
 * by new session only, so a long-lived session refreshing in the background does not.
 */
function returnedSql(): SQL<boolean> {
  const after = sql`e.sent_at`;
  const until = sql`e.sent_at + make_interval(days => ${CHECK_IN_RETURN_DAYS})`;
  const within = (column: SQL) => sql`${column} > ${after} and ${column} <= ${until}`;
  return sql<boolean>`(
    exists (select 1 from sessions s where s.user_id = e.user_id
      and ${within(sql`(s.created_at at time zone 'UTC')`)})
    or exists (select 1 from businesses b where b.owner_user_id = e.user_id
      and ${within(sql`b.created_at`)})
    or exists (select 1 from businesses b join invoices i on i.business_id = b.id
      where b.owner_user_id = e.user_id and ${within(sql`i.created_at`)})
    or exists (select 1 from invoice_issuances ii where ii.user_id = e.user_id
      and ${within(sql`ii.issued_at`)})
    or exists (select 1 from businesses b join invoice_payments p on p.business_id = b.id
      where b.owner_user_id = e.user_id and ${within(sql`p.created_at`)})
    or exists (select 1 from businesses b join clients c on c.business_id = b.id
      where b.owner_user_id = e.user_id and ${within(sql`c.created_at`)})
  )`;
}

interface StepRow {
  segment: ReengagementSegment;
  step: ReengagementStep;
  sent: number;
  returned: number;
  stillOpen: number;
}

/** Check-in emails sent in a range and how many brought the account back (D069). */
@Injectable()
export class AdminCheckInsService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    @Inject(ENV) private readonly env: Pick<Env, "REENGAGEMENT_JOBS" | "REENGAGEMENT_DAILY_LIMIT">,
  ) {}

  async checkIns(range: AdminRange, now = new Date()): Promise<AdminCheckIns> {
    const plan = planRange(range, now);
    const windowOpenSince = new Date(now.getTime() - CHECK_IN_RETURN_DAYS * DAY_MS);
    const inRange = sql`e.sent_at >= ${at(plan.start)} and e.sent_at < ${at(plan.end)}`;

    const rows = await selectRows<StepRow>(
      this.connection.db,
      sql`
        with emails as (
          select e.segment, e.step, e.sent_at, ${returnedSql()} as returned
          from reengagement_emails e
          where ${inRange}
        )
        select segment, step, count(*)::int as sent,
          count(*) filter (where returned)::int as returned,
          count(*) filter (where not returned and sent_at > ${at(windowOpenSince)})::int
            as "stillOpen"
        from emails
        group by segment, step
      `,
    );
    const [totals] = await selectRows<{ accounts: number; unsubscribed: number }>(
      this.connection.db,
      sql`
        select
          (select count(distinct e.user_id) from reengagement_emails e where ${inRange})::int
            as accounts,
          (select count(*) from email_opt_outs o
            where o.created_at >= ${at(plan.start)} and o.created_at < ${at(plan.end)})::int
            as unsubscribed
      `,
    );

    const byKey = new Map(rows.map((row) => [`${row.segment}:${row.step}`, row]));
    const steps = reengagementSegments.flatMap((segment) =>
      reengagementSteps.map((step) => {
        const row = byKey.get(`${segment}:${step}`);
        const sent = row?.sent ?? 0;
        const returned = row?.returned ?? 0;
        return { segment, step, sent, returned, returnRate: ratio(returned, sent) };
      }),
    );
    const sent = rows.reduce((total, row) => total + row.sent, 0);
    const returned = rows.reduce((total, row) => total + row.returned, 0);

    return {
      enabled: this.env.REENGAGEMENT_JOBS,
      dailyLimit: this.env.REENGAGEMENT_DAILY_LIMIT,
      period: { start: plan.start.toISOString(), end: plan.end.toISOString() },
      returnWindowDays: CHECK_IN_RETURN_DAYS,
      totals: {
        sent,
        accounts: totals?.accounts ?? 0,
        returned,
        returnRate: ratio(returned, sent),
        stillOpen: rows.reduce((total, row) => total + row.stillOpen, 0),
        unsubscribed: totals?.unsubscribed ?? 0,
      },
      steps,
      generatedAt: now.toISOString(),
    };
  }
}
