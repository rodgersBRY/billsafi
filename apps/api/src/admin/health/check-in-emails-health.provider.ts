import { type DatabaseConnection, sql } from "@billsafi/db";
import { at, selectRows } from "../shared/admin-sql.js";
import type { HealthIndicatorProvider, HealthReading } from "./health-provider.js";
import { ageText, HOUR_MS } from "./recorded-health.format.js";

/** The job runs hourly, so one missed run is a warning and three are failing. */
export const CHECK_IN_JOB_OK_WITHIN_MS = 90 * 60 * 1000;
export const CHECK_IN_JOB_FAILING_AFTER_MS = 3 * HOUR_MS;

interface LastRun {
  status: string;
  finishedAt: Date;
  detail: string | null;
}

/**
 * The check-in emails job (D069): its last run, and how many emails went out in the last
 * 24 hours against the daily limit. Unknown when the job is switched off here.
 */
export class CheckInEmailsHealthProvider implements HealthIndicatorProvider {
  readonly key = "check_in_emails";
  readonly label = "Check-in emails";
  readonly source = "Job runs";
  readonly staleAfterSeconds = null;

  constructor(
    private readonly connection: DatabaseConnection,
    private readonly enabled: boolean,
    private readonly dailyLimit: number,
  ) {}

  async check(now: Date): Promise<HealthReading> {
    if (!this.enabled) {
      return {
        status: "unknown",
        value: null,
        detail:
          "Check-in emails are switched off in this environment (REENGAGEMENT_JOBS=off), so no runs are expected.",
      };
    }
    const [last] = await selectRows<LastRun>(
      this.connection.db,
      sql`select status, finished_at as "finishedAt", detail from job_runs
        where job = 'reengagement_emails' order by finished_at desc limit 1`,
    );
    if (!last) {
      return {
        status: "unknown",
        value: null,
        detail: "The job hasn't run yet. The first run comes 5 minutes after the API starts.",
      };
    }
    const [sent] = await selectRows<{ count: number }>(
      this.connection.db,
      sql`select count(*)::int as count from reengagement_emails
        where sent_at > ${at(new Date(now.getTime() - 24 * HOUR_MS))}`,
    );
    const sent24h = sent?.count ?? 0;
    const age = now.getTime() - new Date(last.finishedAt).getTime();
    const lastRun = `Last run ${ageText(age)} ago`;
    const outcome = last.detail ? `: ${last.detail}` : "";

    let status: HealthReading["status"] = "ok";
    let detail = `${lastRun}${outcome}.`;
    if (last.status === "failed") {
      status = "failing";
      detail = `The last run failed ${ageText(age)} ago. The API log has the error.`;
    } else if (age > CHECK_IN_JOB_FAILING_AFTER_MS) {
      status = "failing";
      detail = `${lastRun}. The job runs every hour, so it has missed several runs.`;
    } else if (age > CHECK_IN_JOB_OK_WITHIN_MS) {
      status = "warning";
      detail = `${lastRun}. The job runs every hour.`;
    }
    return {
      status,
      value: `${sent24h} of ${this.dailyLimit} sent in 24h`,
      detail,
      data: { sent24h, dailyLimit: this.dailyLimit },
      checkedAt: new Date(last.finishedAt),
    };
  }
}
