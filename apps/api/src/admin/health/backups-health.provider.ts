import { type DatabaseConnection, sql } from "@billsafi/db";
import { selectRows } from "../shared/admin-sql.js";
import type { HealthIndicatorProvider, HealthReading } from "./health-provider.js";
import { ageText, HOUR_MS } from "./recorded-health.format.js";

/** A good backup under this age is fine (the job runs nightly), under the warning age is late. */
export const BACKUP_OK_WITHIN_MS = 26 * HOUR_MS;
export const BACKUP_WARNING_WITHIN_MS = 50 * HOUR_MS;

interface Run {
  status: string;
  finishedAt: Date;
  sizeBytes: string | number | null;
}

/** The age of the last good backup and whether the last run worked (D066). */
export class BackupsHealthProvider implements HealthIndicatorProvider {
  readonly key = "backups";
  readonly label = "Backups";
  readonly source = "Backup runs";
  readonly staleAfterSeconds = null;

  constructor(private readonly connection: DatabaseConnection) {}

  async check(now: Date): Promise<HealthReading> {
    const rows = await selectRows<Run>(
      this.connection.db,
      sql`
        (select status, finished_at as "finishedAt", size_bytes as "sizeBytes" from backup_runs
          order by finished_at desc limit 1)
        union all
        (select status, finished_at, size_bytes from backup_runs where status = 'succeeded'
          order by finished_at desc limit 1)
      `,
    );
    const last = rows[0];
    if (!last) {
      return {
        status: "unknown",
        value: null,
        detail:
          "No backup has been recorded yet. backup.sh records each run once it is updated on the server.",
      };
    }
    const good = rows.find((row) => row.status === "succeeded");
    const lastAt = new Date(last.finishedAt);
    const goodAge = good ? now.getTime() - new Date(good.finishedAt).getTime() : null;
    const data = {
      lastGoodAgeHours: goodAge === null ? null : Math.floor(goodAge / HOUR_MS),
      lastGoodSizeBytes: good?.sizeBytes == null ? null : Number(good.sizeBytes),
    };
    const goodText = good
      ? `The last good backup was ${ageText(goodAge!)} ago.`
      : "There is no good backup on record.";
    const value = good ? `Last good backup ${ageText(goodAge!)} ago` : "No good backup";
    if (last.status === "failed") {
      return {
        status: "failing",
        value,
        detail: `The last backup run failed. ${goodText}`,
        data,
        checkedAt: lastAt,
      };
    }
    const status =
      goodAge! < BACKUP_OK_WITHIN_MS
        ? "ok"
        : goodAge! < BACKUP_WARNING_WITHIN_MS
          ? "warning"
          : "failing";
    return {
      status,
      value,
      detail:
        status === "ok"
          ? "The nightly backup ran in the last 26 hours."
          : `${goodText} The nightly backup is overdue.`,
      data,
      checkedAt: lastAt,
    };
  }
}
