import { ConflictException, Inject, Injectable } from "@nestjs/common";
import type { AllowanceUsage } from "@tallynest/contracts";
import { and, type Database, type DatabaseConnection, eq, schema, sql } from "@tallynest/db";
import { nairobiCalendarMonth } from "@tallynest/domain";
import { DATABASE } from "../database/database.module.js";

const { usagePeriods, invoiceIssuances } = schema;

/** Free plan: 10 invoices per Africa/Nairobi calendar month across all businesses (D019, D044). */
export const FREE_PLAN = { code: "free", invoiceLimit: 10 } as const;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

@Injectable()
export class AllowanceService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  async usage(userId: string, at = new Date()): Promise<AllowanceUsage> {
    const period = nairobiCalendarMonth(at);
    const used = await this.countIssued(this.connection.db, userId, period.start, period.end);
    return {
      plan: FREE_PLAN.code,
      limit: FREE_PLAN.invoiceLimit,
      used,
      periodStart: period.start.toISOString(),
      periodEnd: period.end.toISOString(),
    };
  }

  /**
   * Locks the account's current usage period so concurrent Ready requests across
   * all its businesses run one at a time, then checks the remaining allowance.
   * Returns the period id to record the issuance against.
   */
  async reserve(tx: Transaction, userId: string, at: Date): Promise<string> {
    const period = nairobiCalendarMonth(at);
    await tx
      .insert(usagePeriods)
      .values({
        userId,
        planCode: FREE_PLAN.code,
        startsAt: period.start,
        endsAt: period.end,
        invoiceLimit: FREE_PLAN.invoiceLimit,
      })
      .onConflictDoNothing({
        target: [usagePeriods.userId, usagePeriods.planCode, usagePeriods.startsAt],
      });
    const [locked] = await tx
      .select()
      .from(usagePeriods)
      .where(
        and(
          eq(usagePeriods.userId, userId),
          eq(usagePeriods.planCode, FREE_PLAN.code),
          eq(usagePeriods.startsAt, period.start),
        ),
      )
      .for("update");

    // Counted by issuance time so the downgrade rule (D044) carries over once Pro exists.
    const used = await this.countIssued(tx, userId, period.start, period.end);
    if (used >= locked!.invoiceLimit) {
      throw new ConflictException({
        code: "ALLOWANCE_REACHED",
        message: `You've made ${locked!.invoiceLimit} invoices Ready this month, the Free plan limit.`,
        usage: { used, limit: locked!.invoiceLimit, periodEnd: period.end.toISOString() },
      });
    }
    return locked!.id;
  }

  private async countIssued(db: Database | Transaction, userId: string, start: Date, end: Date) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoiceIssuances)
      .where(
        and(
          eq(invoiceIssuances.userId, userId),
          sql`${invoiceIssuances.issuedAt} >= ${start.toISOString()}`,
          sql`${invoiceIssuances.issuedAt} < ${end.toISOString()}`,
        ),
      );
    return row!.count;
  }
}
