import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthService } from "@thallesp/nestjs-better-auth";
import type { Auth } from "../auth/auth.js";

/**
 * Suspends, reactivates and signs out accounts on behalf of an admin.
 *
 * Uses Better Auth's internal adapter (the same calls the admin plugin's banUser and
 * revokeUserSessions make) instead of auth.api.banUser. Those server functions demand an
 * admin session in the request headers and re-check it with the plugin's own permissions;
 * here our AdminGuard and audit log already decide who may act, so forwarding cookies
 * would only add a second, weaker gate. Sign-in stays blocked by the plugin itself: its
 * session-create hook rejects banned users for every method, email and Google included.
 *
 * That hook only runs inside a Better Auth endpoint call. Sessions must therefore only ever
 * be created through Better Auth's endpoints, never with internalAdapter.createSession or a
 * direct insert. SessionGuard is the backstop: banned users count as signed out anyway.
 */
@Injectable()
export class AccountAccessService {
  constructor(private readonly auth: AuthService<Auth>) {}

  /**
   * Bans first, then deletes sessions. If deletion fails twice this throws so the caller
   * records a failure; the ban still stands and SessionGuard already rejects the account.
   */
  async suspend(userId: string, reason: string): Promise<void> {
    const adapter = await this.adapter();
    await this.requireUser(userId);
    await adapter.updateUser(userId, {
      banned: true,
      banReason: reason,
      banExpires: null,
      updatedAt: new Date(),
    });
    await this.deleteSessions(userId);
  }

  async reactivate(userId: string): Promise<void> {
    const adapter = await this.adapter();
    await this.requireUser(userId);
    await adapter.updateUser(userId, {
      banned: false,
      banReason: null,
      banExpires: null,
      updatedAt: new Date(),
    });
  }

  async revokeSessions(userId: string): Promise<void> {
    await this.requireUser(userId);
    await this.deleteSessions(userId);
  }

  /** One retry covers a dropped connection; a second failure goes to the caller. */
  private async deleteSessions(userId: string): Promise<void> {
    const adapter = await this.adapter();
    try {
      await adapter.deleteUserSessions(userId);
    } catch {
      await adapter.deleteUserSessions(userId);
    }
  }

  private async adapter() {
    return (await this.auth.instance.$context).internalAdapter;
  }

  private async requireUser(userId: string): Promise<void> {
    const user = await (await this.adapter()).findUserById(userId);
    if (!user) throw new NotFoundException("User not found");
  }
}
