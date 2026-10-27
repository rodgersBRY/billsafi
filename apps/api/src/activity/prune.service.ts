import { Inject, Injectable } from "@nestjs/common";
import {
  BACKUP_RUN_RETENTION_MONTHS,
  FAILURE_RETENTION_DAYS,
  JOB_RUN_RETENTION_DAYS,
  PRODUCT_EVENT_RETENTION_MONTHS,
} from "@billsafi/contracts";
import { type DatabaseConnection, lt, schema } from "@billsafi/db";
import { addNairobiMonths } from "@billsafi/domain";
import { DATABASE } from "../database/database.module.js";

const DAY_MS = 24 * 60 * 60 * 1000;

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

  async prune(now = new Date()): Promise<PruneCounts> {
    const db = this.connection.db;
    const months = (count: number) => addNairobiMonths(now, -count);
    const days = (count: number) => new Date(now.getTime() - count * DAY_MS);
    const gone = async (deleted: Promise<unknown[]>) => (await deleted).length;
    const { productEvents, operationFailures, failedSignIns, jobRuns, backupRuns } = schema;
    return {
      productEvents: await gone(
        db
          .delete(productEvents)
          .where(lt(productEvents.createdAt, months(PRODUCT_EVENT_RETENTION_MONTHS)))
          .returning({ id: productEvents.id }),
      ),
      operationFailures: await gone(
        db
          .delete(operationFailures)
          .where(lt(operationFailures.createdAt, days(FAILURE_RETENTION_DAYS)))
          .returning({ id: operationFailures.id }),
      ),
      failedSignIns: await gone(
        db
          .delete(failedSignIns)
          .where(lt(failedSignIns.createdAt, days(FAILURE_RETENTION_DAYS)))
          .returning({ id: failedSignIns.id }),
      ),
      jobRuns: await gone(
        db
          .delete(jobRuns)
          .where(lt(jobRuns.finishedAt, days(JOB_RUN_RETENTION_DAYS)))
          .returning({ id: jobRuns.id }),
      ),
      backupRuns: await gone(
        db
          .delete(backupRuns)
          .where(lt(backupRuns.finishedAt, months(BACKUP_RUN_RETENTION_MONTHS)))
          .returning({ id: backupRuns.id }),
      ),
    };
  }
}
