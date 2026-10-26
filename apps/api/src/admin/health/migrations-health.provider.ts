import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type DatabaseConnection, sql } from "@billsafi/db";
import { z } from "zod";
import { selectRows } from "../shared/admin-sql.js";
import type { HealthIndicatorProvider, HealthReading } from "./health-provider.js";

const journalSchema = z.object({
  entries: z.array(z.object({ idx: z.number(), when: z.number(), tag: z.string() })),
});
export type MigrationJournal = z.output<typeof journalSchema>["entries"];

/** The journal Drizzle wrote beside the migrations; the API image copies the folder in. */
export function readBundledJournal(): MigrationJournal | null {
  const file = fileURLToPath(
    new URL("../drizzle/meta/_journal.json", import.meta.resolve("@billsafi/db")),
  );
  if (!existsSync(file)) return null;
  const parsed = journalSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  return parsed.success ? parsed.data.entries : null;
}

/**
 * Compares what the database has applied with the migrations bundled with this API build.
 * Drizzle stores each migration's journal time in drizzle.__drizzle_migrations.created_at,
 * so "behind" means bundled migrations newer than the newest applied one.
 */
export class MigrationsHealthProvider implements HealthIndicatorProvider {
  readonly key = "migrations";
  readonly label = "Migrations";
  readonly source = "Live query and bundled journal";
  readonly staleAfterSeconds = null;

  constructor(
    private readonly connection: DatabaseConnection,
    private readonly journal: () => MigrationJournal | null = readBundledJournal,
  ) {}

  async check(): Promise<HealthReading> {
    const bundled = this.journal();
    if (!bundled || bundled.length === 0) {
      return {
        status: "unknown",
        value: null,
        detail: "The migration list bundled with this build could not be read.",
      };
    }
    const [row] = await selectRows<{ latest: string | null; applied: number }>(
      this.connection.db,
      sql`select max(created_at)::text as latest, count(*)::int as applied
          from drizzle.__drizzle_migrations`,
    );
    const latestApplied = row?.latest ? Number(row.latest) : null;
    const pending = bundled.filter((entry) => latestApplied === null || entry.when > latestApplied);
    const newest = bundled.reduce((a, b) => (b.when > a.when ? b : a));
    const current = bundled.find((entry) => entry.when === latestApplied);
    const data = { applied: row?.applied ?? 0, bundled: bundled.length, pending: pending.length };
    if (pending.length > 0) {
      return {
        status: "warning",
        value: current?.tag ?? `${data.applied} applied`,
        detail: `${pending.length} bundled ${
          pending.length === 1 ? "migration is" : "migrations are"
        } not applied yet, up to ${newest.tag}. Run the migrate job.`,
        data,
      };
    }
    return {
      status: "ok",
      value: current?.tag ?? newest.tag,
      detail: "The database has every migration bundled with this build.",
      data,
    };
  }
}
