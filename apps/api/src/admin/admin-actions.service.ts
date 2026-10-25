import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { AdminActionAck, AdminTenantRow, AdminUserRow } from "@billsafi/contracts";
import { type DatabaseConnection, eq, schema } from "@billsafi/db";
import { type AuditRequest, AuditService } from "../audit/audit.service.js";
import { DATABASE } from "../database/database.module.js";
import type { Transaction } from "../database/transaction.js";
import { AccountAccessService } from "./account-access.service.js";
import { AdminTenantsService } from "./admin-tenants.service.js";
import { AdminUsersService } from "./admin-users.service.js";
import { ADMIN_CACHE, type TtlCache } from "./ttl-cache.js";

/** Who is acting, why, and the request it came from. */
export interface AdminActionContext {
  adminId: string;
  reason: string;
  request: AuditRequest;
}

export interface ActionTarget {
  action: string;
  target: { type: "account" | "user" | "override"; id: string };
}

/** What an action's change step returns: the audit diff and the response. */
export interface ActionOutcome<T> {
  changes: Record<string, unknown>;
  result: T;
}

export function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

/** What a failure row keeps: the status and message for HTTP errors, nothing internal. */
function describeError(error: unknown) {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    const code = typeof body === "object" && body && "code" in body ? String(body.code) : undefined;
    return { status: error.getStatus(), ...(code ? { code } : {}), message: error.message };
  }
  return { status: 500, message: "Unexpected error" };
}

/**
 * Admin actions that change accounts. Each one checks its preconditions under a row lock,
 * makes the change and writes the success audit row in the same transaction. Anything
 * that stops it, a refusal included, rolls the change back and writes a failure row.
 */
@Injectable()
export class AdminActionsService {
  private readonly logger = new Logger(AdminActionsService.name);

  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly audit: AuditService,
    private readonly access: AccountAccessService,
    private readonly tenants: AdminTenantsService,
    private readonly users: AdminUsersService,
    @Inject(ADMIN_CACHE) private readonly cache: TtlCache,
  ) {}

  async suspendTenant(
    context: AdminActionContext,
    id: string,
  ): Promise<AdminTenantRow | AdminActionAck> {
    await this.perform(
      context,
      { action: "tenant.suspend", target: { type: "account", id } },
      async (tx) => {
        const user = await this.lockUser(tx, id);
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
    return this.summaryAfter(context.adminId, () => this.tenants.summary(id));
  }

  async reactivateTenant(
    context: AdminActionContext,
    id: string,
  ): Promise<AdminTenantRow | AdminActionAck> {
    await this.perform(
      context,
      { action: "tenant.reactivate", target: { type: "account", id } },
      async (tx) => {
        const user = await this.lockUser(tx, id);
        if (!user.banned) throw conflict("NOT_SUSPENDED", "This account is not suspended.");
        await this.access.reactivate(id, tx);
        return { banned: { from: true, to: false } };
      },
    );
    return this.summaryAfter(context.adminId, () => this.tenants.summary(id));
  }

  async revokeSessions(
    context: AdminActionContext,
    id: string,
  ): Promise<AdminUserRow | AdminActionAck> {
    await this.perform(
      context,
      { action: "user.revoke_sessions", target: { type: "user", id } },
      async (tx) => {
        await this.lockUser(tx, id);
        // Revoking another admin's sessions stays allowed: it is the answer to a stolen
        // admin session. Revoking your own would only sign you out mid-action.
        if (id === context.adminId) {
          throw conflict("CANNOT_REVOKE_SELF", "You can't revoke your own sessions here.");
        }
        const revoked = await this.access.revokeSessions(id, tx);
        return { sessions: { from: revoked, to: 0 } };
      },
    );
    return this.summaryAfter(context.adminId, () => this.users.summary(id));
  }

  /**
   * The change has committed by now, so a failure to read the fresh row must not look
   * like a failed action: log it and answer a bare acknowledgement instead of a 500.
   */
  private async summaryAfter<T>(
    adminId: string,
    load: () => Promise<T>,
  ): Promise<T | AdminActionAck> {
    try {
      return await load();
    } catch (error) {
      this.logger.error(`Admin ${adminId}'s action committed, but its summary failed`, error);
      return { ok: true };
    }
  }

  /** Locks the user row so two admins acting at once take turns; 404 when unknown. */
  async lockUser(tx: Transaction, id: string) {
    const [user] = await tx
      .select({
        role: schema.users.role,
        banned: schema.users.banned,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .for("update");
    if (!user) throw new NotFoundException("Account not found");
    return user;
  }

  private async perform(
    context: AdminActionContext,
    target: ActionTarget,
    change: (tx: Transaction) => Promise<Record<string, unknown>>,
  ): Promise<void> {
    await this.performWith(context, target, async (tx) => ({
      changes: await change(tx),
      result: undefined,
    }));
  }

  /**
   * Runs one audited action and returns what its change step produced. The success row
   * commits with the change; any error rolls both back and writes a failure row instead.
   * Every admin cache entry is cleared afterwards, since an action can move any list or
   * metric (directories, subscriptions, payments, grants, overrides, overview, billing).
   */
  async performWith<T>(
    context: AdminActionContext,
    { action, target }: ActionTarget,
    change: (tx: Transaction) => Promise<ActionOutcome<T>>,
  ): Promise<T> {
    const entry = {
      actor: { userId: context.adminId, role: "admin" },
      action,
      target,
      reason: context.reason,
      request: context.request,
    };
    let result: T;
    try {
      result = await this.connection.db.transaction(async (tx) => {
        const outcome = await change(tx);
        await this.audit.record({ ...entry, outcome: "success", changes: outcome.changes }, tx);
        return outcome.result;
      });
    } catch (error) {
      try {
        await this.audit.record({
          ...entry,
          outcome: "failure",
          changes: { error: describeError(error) },
        });
      } catch (auditError) {
        // The original error is what the admin needs to see; log the audit failure.
        this.logger.error(`Could not record a failed ${action}`, auditError);
      }
      throw error;
    }
    this.cache.invalidate("");
    return result;
  }
}
