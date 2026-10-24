import { Inject, Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { and, type DatabaseConnection, eq, inArray, notInArray, schema } from "@billsafi/db";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { DATABASE } from "../database/database.module.js";

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
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.sync();
  }

  async sync(): Promise<AdminRoleSyncResult> {
    const listed = this.env.ADMIN_USER_IDS;
    const { users } = schema;
    const result = await this.connection.db.transaction(async (tx) => {
      const found = listed.length
        ? await tx
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(inArray(users.id, listed))
        : [];
      const promoted = found.filter((user) => user.role !== "admin").map((user) => user.id);
      if (promoted.length) {
        await tx.update(users).set({ role: "admin" }).where(inArray(users.id, promoted));
      }
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
      const known = new Set(found.map((user) => user.id));
      return { promoted, demoted, unknown: listed.filter((id) => !known.has(id)) };
    });

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
