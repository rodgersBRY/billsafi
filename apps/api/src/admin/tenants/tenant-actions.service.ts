import { Inject, Injectable } from "@nestjs/common";
import type { AdminActionAck, AdminTenantRow } from "@billsafi/contracts";
import type { DatabaseConnection } from "@billsafi/db";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { DATABASE } from "../../database/database.module.js";
import { accountReactivatedEmail, accountSuspendedEmail } from "../../mail/account-templates.js";
import { MAILER } from "../../mail/mail.module.js";
import type { Mailer } from "../../mail/mailer.js";
import { emailAccount } from "../../mail/notify-account.js";
import {
  AdminActionRunner,
  type AdminActionContext,
  conflict,
} from "../shared/admin-action-runner.js";
import { AccountAccessService } from "./account-access.service.js";
import { AdminTenantsService } from "./admin-tenants.service.js";

/** Admin actions that suspend and reactivate accounts. */
@Injectable()
export class TenantActionsService {
  constructor(
    private readonly runner: AdminActionRunner,
    private readonly access: AccountAccessService,
    private readonly tenants: AdminTenantsService,
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async suspendTenant(
    context: AdminActionContext,
    id: string,
  ): Promise<AdminTenantRow | AdminActionAck> {
    await this.runner.perform(
      context,
      { action: "tenant.suspend", target: { type: "account", id } },
      async (tx) => {
        const user = await this.runner.lockUser(tx, id);
        if (id === context.adminId) {
          throw conflict("CANNOT_SUSPEND_SELF", "You can't suspend your own account.");
        }
        if (user.role === "admin") {
          throw conflict(
            "CANNOT_SUSPEND_ADMIN",
            "Admins can't be suspended. Remove them from ADMIN_USER_IDS and restart the API first.",
          );
        }
        if (user.banned) {
          throw conflict("ALREADY_SUSPENDED", "This account is already suspended.");
        }
        await this.access.suspend(id, context.reason, tx);
        return { banned: { from: false, to: true } };
      },
    );
    await emailAccount(
      this.connection.db,
      this.mailer,
      id,
      "account_suspended_email",
      (user, support) => accountSuspendedEmail(user.email, user.name, support, this.env.WEB_ORIGIN),
    );
    return this.runner.summaryAfter(context.adminId, () => this.tenants.summary(id));
  }

  async reactivateTenant(
    context: AdminActionContext,
    id: string,
  ): Promise<AdminTenantRow | AdminActionAck> {
    await this.runner.perform(
      context,
      { action: "tenant.reactivate", target: { type: "account", id } },
      async (tx) => {
        const user = await this.runner.lockUser(tx, id);
        if (!user.banned) throw conflict("NOT_SUSPENDED", "This account is not suspended.");
        await this.access.reactivate(id, tx);
        return { banned: { from: true, to: false } };
      },
    );
    await emailAccount(this.connection.db, this.mailer, id, "account_reactivated_email", (user) =>
      accountReactivatedEmail(user.email, user.name, `${this.env.WEB_ORIGIN}/sign-in`),
    );
    return this.runner.summaryAfter(context.adminId, () => this.tenants.summary(id));
  }
}
