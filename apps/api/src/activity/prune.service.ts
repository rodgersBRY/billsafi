import { Inject, Injectable } from "@nestjs/common";
import {
  BACKUP_RUN_RETENTION_MONTHS,
  FAILURE_RETENTION_DAYS,
  JOB_RUN_RETENTION_DAYS,
  PRODUCT_EVENT_RETENTION_MONTHS,
} from "@billsafi/contracts";
import { type DatabaseConnection, sql } from "@billsafi/db";
import { addNairobiMonths } from "@billsafi/domain";
import { DATABASE } from "../database/database.module.js";

const DAY_MS = 24 * 60 * 60 * 1000;
export const PRUNE_BATCH_SIZE = 5000;

export interface PruneCounts {
  productEvents: number;
  operationFailures: number;
  failedSignIns: number;
  jobRuns: number;
  backupRuns: number;
}

/** Deletes recorded facts past their retention, which the privacy page promises (D066). */
@Injectable()
export class PruneService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  /** Deletes in batches so a big backlog never holds one long lock. */
  private async deleteOlder(table: string, column: string, cutoff: Date): Promise<number> {
    let total = 0;
    for (;;) {
      const result = await this.connection.db.execute(sql`
        delete from ${sql.identifier(table)} where id in (
          select id from ${sql.identifier(table)}
          where ${sql.identifier(column)} < ${cutoff.toISOString()}::timestamptz
          limit ${PRUNE_BATCH_SIZE})
      `);
      const deleted = result.rowCount ?? 0;
      total += deleted;
      if (deleted < PRUNE_BATCH_SIZE) return total;
    }
  }

  async prune(now = new Date()): Promise<PruneCounts> {
    const months = (count: number) => addNairobiMonths(now, -count);
    const days = (count: number) => new Date(now.getTime() - count * DAY_MS);
    return {
      productEvents: await this.deleteOlder(
        "product_events",
        "created_at",
        months(PRODUCT_EVENT_RETENTION_MONTHS),
      ),
      operationFailures: await this.deleteOlder(
        "operation_failures",
        "created_at",
        days(FAILURE_RETENTION_DAYS),
      ),
      failedSignIns: await this.deleteOlder(
        "failed_sign_ins",
        "created_at",
        days(FAILURE_RETENTION_DAYS),
      ),
      jobRuns: await this.deleteOlder("job_runs", "finished_at", days(JOB_RUN_RETENTION_DAYS)),
      backupRuns: await this.deleteOlder(
        "backup_runs",
        "finished_at",
        months(BACKUP_RUN_RETENTION_MONTHS),
      ),
    };
  }
}
