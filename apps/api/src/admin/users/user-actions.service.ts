import { Inject, Injectable } from "@nestjs/common";
import type { AdminActionAck, AdminUserRow } from "@billsafi/contracts";
import type { DatabaseConnection } from "@billsafi/db";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { DATABASE } from "../../database/database.module.js";
import { signedOutEverywhereEmail } from "../../mail/account-templates.js";
import { MAILER } from "../../mail/mail.module.js";
import type { Mailer } from "../../mail/mailer.js";
import { emailAccount } from "../../mail/notify-account.js";
import {
  AdminActionRunner,
  type AdminActionContext,
  conflict,
} from "../shared/admin-action-runner.js";
import { AccountAccessService } from "../tenants/account-access.service.js";
import { AdminUsersService } from "./admin-users.service.js";

/** Admin actions on a single user. */
@Injectable()
export class UserActionsService {
  constructor(
    private readonly runner: AdminActionRunner,
    private readonly access: AccountAccessService,
    private readonly users: AdminUsersService,
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async revokeSessions(
    context: AdminActionContext,
    id: string,
  ): Promise<AdminUserRow | AdminActionAck> {
    await this.runner.perform(
      context,
      { action: "user.revoke_sessions", target: { type: "user", id } },
      async (tx) => {
        await this.runner.lockUser(tx, id);
        // Revoking another admin's sessions stays allowed: it is the answer to a stolen
        // admin session. Revoking your own would only sign you out mid-action.
        if (id === context.adminId) {
          throw conflict("CANNOT_REVOKE_SELF", "You can't revoke your own sessions here.");
        }
        const revoked = await this.access.revokeSessions(id, tx);
        return { sessions: { from: revoked, to: 0 } };
      },
    );
    await emailAccount(this.connection.db, this.mailer, id, "signed_out_everywhere_email", (user) =>
      signedOutEverywhereEmail(
        user.email,
        user.name,
        `${this.env.WEB_ORIGIN}/sign-in`,
        `${this.env.WEB_ORIGIN}/forgot-password`,
      ),
    );
    return this.runner.summaryAfter(context.adminId, () => this.users.summary(id));
  }
}
