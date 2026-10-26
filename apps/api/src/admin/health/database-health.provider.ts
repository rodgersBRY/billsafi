import { type DatabaseConnection, sql } from "@billsafi/db";
import type { HealthIndicatorProvider, HealthReading } from "./health-provider.js";

/** Over this the database still answers, but slowly. */
export const DATABASE_SLOW_MS = 200;

export class DatabaseHealthProvider implements HealthIndicatorProvider {
  readonly key = "database";
  readonly label = "Database";
  readonly source = "Live query";
  readonly staleAfterSeconds = null;

  constructor(private readonly connection: DatabaseConnection) {}

  async check(): Promise<HealthReading> {
    const started = performance.now();
    await this.connection.db.execute(sql`select 1`);
    const ms = Math.round(performance.now() - started);
    const slow = ms > DATABASE_SLOW_MS;
    return {
      status: slow ? "warning" : "ok",
      value: `${ms} ms`,
      detail: slow
        ? `The database answered, but took longer than ${DATABASE_SLOW_MS} ms.`
        : "The database answered a test query.",
      data: { responseMs: ms },
    };
  }
}
