import { type DatabaseConnection, sql } from "@billsafi/db";
import { selectRows } from "../shared/admin-sql.js";
import type { HealthIndicatorProvider, HealthReading } from "./health-provider.js";
import { ageText, HOUR_MS, MINUTE_MS } from "./recorded-health.format.js";

/** A step that last finished more than this long ago is late; the jobs run every 5 minutes. */
export const JOBS_OK_WITHIN_MS = 15 * MINUTE_MS;
/** Later than this, or a failed last run, is failing. */
export const JOBS_FAILING_AFTER_MS = HOUR_MS;

export const BILLING_JOB_STEPS = [
  { job: "billing_sweep", label: "payment check" },
  { job: "renewal_reminders", label: "renewal reminders" },
  { job: "idempotency_prune", label: "key clean-up" },
] as const;

interface LastRun {
  job: string;
  status: string;
  finishedAt: Date;
}

/**
 * The last run of each billing job step (D066). Unknown when the jobs are switched off in
 * this environment, because then a missing run is expected and not a fault.
 */
export class BillingJobsHealthProvider implements HealthIndicatorProvider {
  readonly key = "billing_jobs";
  readonly label = "Billing jobs";
  readonly source = "Job runs";
  readonly staleAfterSeconds = null;

  constructor(
    private readonly connection: DatabaseConnection,
    private readonly enabled: boolean,
  ) {}

  async check(now: Date): Promise<HealthReading> {
    if (!this.enabled) {
      return {
        status: "unknown",
        value: null,
        detail:
          "Billing jobs are switched off in this environment (BILLING_JOBS=off), so no runs are expected.",
      };
    }
    const rows = await selectRows<LastRun>(
      this.connection.db,
      sql`
        select distinct on (job) job, status, finished_at as "finishedAt"
        from job_runs
        where job in (${sql.join(
          BILLING_JOB_STEPS.map((step) => sql`${step.job}`),
          sql`, `,
        )})
        order by job, finished_at desc
      `,
    );
    if (rows.length === 0) {
      return {
        status: "unknown",
        value: null,
        detail:
          "No billing job has run yet. The first run comes a few seconds after the API starts.",
      };
    }
    const byJob = new Map(rows.map((row) => [row.job, row]));
    const problems: string[] = [];
    let status: HealthReading["status"] = "ok";
    const data: Record<string, number | null> = {};
    let oldest = Infinity;
    for (const step of BILLING_JOB_STEPS) {
      const run = byJob.get(step.job);
      if (!run) {
        status = "failing";
        problems.push(`the ${step.label} has never run`);
        data[`${step.job}AgeMinutes`] = null;
        continue;
      }
      const age = now.getTime() - new Date(run.finishedAt).getTime();
      oldest = Math.min(oldest, new Date(run.finishedAt).getTime());
      data[`${step.job}AgeMinutes`] = Math.max(0, Math.floor(age / MINUTE_MS));
      if (run.status === "failed") {
        status = "failing";
        problems.push(`the last ${step.label} run failed`);
      } else if (age > JOBS_FAILING_AFTER_MS) {
        status = "failing";
        problems.push(`the ${step.label} last ran ${ageText(age)} ago`);
      } else if (age > JOBS_OK_WITHIN_MS && status === "ok") {
        status = "warning";
        problems.push(`the ${step.label} last ran ${ageText(age)} ago`);
      } else if (age > JOBS_OK_WITHIN_MS) {
        problems.push(`the ${step.label} last ran ${ageText(age)} ago`);
      }
    }
    const newest = Math.max(...rows.map((row) => new Date(row.finishedAt).getTime()));
    const worst = Number.isFinite(oldest) ? now.getTime() - oldest : 0;
    const text = problems.join(", and ");
    return {
      status,
      value: `Oldest step ran ${ageText(worst)} ago`,
      detail:
        problems.length > 0
          ? `${text[0]!.toUpperCase()}${text.slice(1)}.`
          : "Every billing job step ran in the last 15 minutes.",
      data,
      checkedAt: new Date(newest),
    };
  }
}
