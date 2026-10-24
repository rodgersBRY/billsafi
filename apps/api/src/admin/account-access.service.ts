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
 */
@Injectable()
export class AccountAccessService {
  constructor(private readonly auth: AuthService<Auth>) {}

  /** Bans the account and deletes its sessions, so open tabs lose access on the next request. */
  async suspend(userId: string, reason: string): Promise<void> {
    const adapter = await this.adapter();
    await this.requireUser(userId);
    await adapter.updateUser(userId, {
      banned: true,
      banReason: reason,
      banExpires: null,
      updatedAt: new Date(),
    });
    await adapter.deleteUserSessions(userId);
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
    const adapter = await this.adapter();
    await this.requireUser(userId);
    await adapter.deleteUserSessions(userId);
  }

  private async adapter() {
    return (await this.auth.instance.$context).internalAdapter;
  }

  private async requireUser(userId: string): Promise<void> {
    const user = await (await this.adapter()).findUserById(userId);
    if (!user) throw new NotFoundException("User not found");
  }
}
