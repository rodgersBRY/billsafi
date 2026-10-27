import { Inject, Injectable } from "@nestjs/common";
import { type DatabaseConnection, schema } from "@billsafi/db";
import { DATABASE } from "../database/database.module.js";
import type { Executor } from "../database/transaction.js";
import { redactChanges } from "./redact.js";

const MAX_REASON_LENGTH = 500;

export type AuditActor = { userId: string; role: string } | "system";

/** The parts of an HTTP request worth keeping; see request-id.ts. */
export interface AuditRequest {
  requestId?: string;
  ip?: string;
}

export interface AuditEntry {
  actor: AuditActor;
  /** Dotted verb such as "tenant.suspend". */
  action: string;
  target: { type: string; id: string };
  outcome: "success" | "failure";
  reason?: string | null;
  /** Before/after values; redacted before they are stored. */
  changes?: unknown;
  request?: AuditRequest;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  /** Appends one row. Pass a transaction to commit the row with the change it describes. */
  async record(entry: AuditEntry, executor: Executor = this.connection.db): Promise<void> {
    const system = entry.actor === "system";
    await executor.insert(schema.auditLogs).values({
      actorUserId: system ? null : (entry.actor as Exclude<AuditActor, "system">).userId,
      actorRole: system ? "system" : (entry.actor as Exclude<AuditActor, "system">).role,
      action: entry.action,
      targetType: entry.target.type,
      targetId: entry.target.id,
      outcome: entry.outcome,
      // The API already limits reasons; this keeps internal callers in line too.
      reason: entry.reason?.slice(0, MAX_REASON_LENGTH) ?? null,
      changes: entry.changes === undefined ? null : redactChanges(entry.changes),
      requestId: entry.request?.requestId ?? null,
      ipAddress: entry.request?.ip ?? null,
    });
  }
}
