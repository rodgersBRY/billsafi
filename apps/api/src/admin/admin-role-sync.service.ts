import { Inject, Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import {
  and,
  type DatabaseConnection,
  eq,
  inArray,
  ne,
  notInArray,
  schema,
  sql,
} from "@billsafi/db";
import { AuditService } from "../audit/audit.service.js";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { DATABASE } from "../database/database.module.js";

/** Arbitrary constant: one advisory lock key reserved for this sync. */
const ROLE_SYNC_LOCK = 4_217_001;

export interface AdminRoleSyncResult {
  promoted: string[];
  demoted: string[];
  /** Listed IDs with no matching user, for example before that person signs up. */
  unknown: string[];
}

/**
 * ADMIN_USER_IDS is the only way to become an admin. On every start the users.role column
 * is brought in line with it, so removing an ID and restarting is the off switch.
 */
@Injectable()
export class AdminRoleSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminRoleSyncService.name);

  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.sync();
  }

  async sync(): Promise<AdminRoleSyncResult> {
    const listed = this.env.ADMIN_USER_IDS;
    const { users } = schema;
    const result = await this.connection.db.transaction(async (tx) => {
      // Two API processes starting together take turns instead of interleaving updates.
      await tx.execute(sql`select pg_advisory_xact_lock(${ROLE_SYNC_LOCK})`);
      const found = listed.length
        ? await tx
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(inArray(users.id, listed))
        : [];
      // RETURNING means only rows this transaction actually changed get an audit row.
      const promotedRows = listed.length
        ? await tx
            .update(users)
            .set({ role: "admin" })
            .where(and(inArray(users.id, listed), ne(users.role, "admin")))
            .returning({ id: users.id })
        : [];
      const promoted = promotedRows.map((user) => user.id);
      const demoted = (
        await tx
          .update(users)
          .set({ role: "user" })
          .where(
            listed.length
              ? and(eq(users.role, "admin"), notInArray(users.id, listed))
              : eq(users.role, "admin"),
          )
          .returning({ id: users.id })
      ).map((user) => user.id);
      // Same transaction: a role change and its audit row land together or not at all.
      const changes = [
        ...found
          .filter((user) => promoted.includes(user.id))
          .map((user) => ({ id: user.id, from: user.role, to: "admin" })),
        ...demoted.map((id) => ({ id, from: "admin", to: "user" })),
      ];
      for (const { id, from, to } of changes) {
        await this.audit.record(
          {
            actor: "system",
            action: "user.role_change",
            target: { type: "user", id },
            outcome: "success",
            reason: "ADMIN_USER_IDS sync on API start",
            changes: { role: { from, to } },
          },
          tx,
        );
      }
      const known = new Set(found.map((user) => user.id));
      return { promoted, demoted, unknown: listed.filter((id) => !known.has(id)) };
    });

    if (!listed.length && result.demoted.length) {
      this.logger.warn(
        `ADMIN_USER_IDS is empty, so ${result.demoted.length} admin(s) were demoted and nobody is admin`,
      );
    }
    // A typo or a not-yet-registered admin must never stop the API from starting.
    for (const id of result.unknown) {
      this.logger.warn(`ADMIN_USER_IDS lists ${id}, but no user has that ID`);
    }
    if (result.promoted.length || result.demoted.length) {
      this.logger.log(
        `Admin roles synced: ${result.promoted.length} promoted, ${result.demoted.length} demoted`,
      );
    }
    return result;
  }
}
