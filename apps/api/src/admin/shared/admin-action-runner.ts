import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { AdminActionAck } from "@billsafi/contracts";
import { type DatabaseConnection, eq, schema } from "@billsafi/db";
import { type AuditRequest, AuditService } from "../../audit/audit.service.js";
import { DATABASE } from "../../database/database.module.js";
import type { Transaction } from "../../database/transaction.js";
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

/**
 * A refusal that changed nothing and is answered some other way (an idempotent replay), so
 * performWith rolls back without writing a failure row.
 */
export class UnauditedRefusal extends ConflictException {}

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
 * Runs admin actions that change accounts. Each one checks its preconditions under a row
 * lock, makes the change and writes the success audit row in the same transaction.
 * Anything that stops it, a refusal included, rolls the change back and writes a failure
 * row.
 */
@Injectable()
export class AdminActionRunner {
  private readonly logger = new Logger(AdminActionRunner.name);

  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly audit: AuditService,
    @Inject(ADMIN_CACHE) private readonly cache: TtlCache,
  ) {}

  /**
   * The change has committed by now, so a failure to read the fresh row must not look
   * like a failed action: log it and answer a bare acknowledgement instead of a 500.
   */
  async summaryAfter<T>(adminId: string, load: () => Promise<T>): Promise<T | AdminActionAck> {
    try {
      return await load();
    } catch (error) {
      this.logger.error(`Admin ${adminId}'s action committed, but its summary failed`, error);
      return { ok: true };
    }
  }

  /**
   * Locks the user row so two admins acting at once take turns; 404 when unknown.
   * FOR NO KEY UPDATE, not FOR UPDATE: rows that reference the user (invoice issuances,
   * payments) take FOR KEY SHARE on it for their foreign key, and Ready and checkout do
   * that while holding the subscription lock. FOR UPDATE would deadlock with them.
   */
  async lockUser(tx: Transaction, id: string) {
    const [user] = await tx
      .select({
        role: schema.users.role,
        banned: schema.users.banned,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .for("no key update");
    if (!user) throw new NotFoundException("Account not found");
    return user;
  }

  async perform(
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
      if (error instanceof UnauditedRefusal) throw error;
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
