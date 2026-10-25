import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type DatabaseConnection, eq, schema } from "@billsafi/db";
import { DATABASE } from "../../database/database.module.js";
import type { Executor, Transaction } from "../../database/transaction.js";

const { sessions, users } = schema;

/**
 * Suspends, reactivates and signs out accounts on behalf of an admin.
 *
 * Writes the admin plugin's columns (banned, ban_reason, ban_expires) and the sessions
 * table directly, which is all its banUser and revokeUserSessions do with no secondary
 * session storage configured. Doing it with Drizzle lets the change and its audit row
 * commit in one transaction; auth.api.banUser would also demand an admin session in the
 * request headers, a second, weaker gate behind our AdminGuard and audit log.
 *
 * Sign-in stays blocked by the plugin itself: its session-create hook rejects banned users
 * for every method, email and Google included. That hook only runs inside a Better Auth
 * endpoint call, so sessions must only ever be created through Better Auth's endpoints.
 * SessionGuard and the get-session hook are the backstop: banned users count as signed out.
 */
@Injectable()
export class AccountAccessService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  /** Runs in the caller's transaction, or in a new one so ban and sign-out land together. */
  private run<T>(executor: Executor | undefined, work: (tx: Executor) => Promise<T>): Promise<T> {
    return executor
      ? work(executor)
      : this.connection.db.transaction((tx: Transaction) => work(tx));
  }

  /** Bans the account and deletes every session it has. */
  suspend(userId: string, reason: string, executor?: Executor): Promise<void> {
    return this.run(executor, async (tx) => {
      await this.requireUser(tx, userId);
      await tx
        .update(users)
        .set({ banned: true, banReason: reason, banExpires: null, updatedAt: new Date() })
        .where(eq(users.id, userId));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
    });
  }

  reactivate(userId: string, executor?: Executor): Promise<void> {
    return this.run(executor, async (tx) => {
      await this.requireUser(tx, userId);
      await tx
        .update(users)
        .set({ banned: false, banReason: null, banExpires: null, updatedAt: new Date() })
        .where(eq(users.id, userId));
    });
  }

  /** Signs the user out everywhere; returns how many sessions were ended. */
  revokeSessions(userId: string, executor?: Executor): Promise<number> {
    return this.run(executor, async (tx) => {
      await this.requireUser(tx, userId);
      const deleted = await tx
        .delete(sessions)
        .where(eq(sessions.userId, userId))
        .returning({ id: sessions.id });
      return deleted.length;
    });
  }

  private async requireUser(executor: Executor, userId: string): Promise<void> {
    const [user] = await executor.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!user) throw new NotFoundException("User not found");
  }
}
