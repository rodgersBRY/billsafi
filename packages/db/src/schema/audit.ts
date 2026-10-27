import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id } from "./columns.js";

/**
 * Append-only record of admin and system actions (D057). A trigger in the migration
 * rejects UPDATE and DELETE. actor_user_id has no foreign key on purpose: deleting a
 * user must never rewrite or cascade into history.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    /** Null for the system, such as the start-up admin role sync. */
    actorUserId: uuid("actor_user_id"),
    actorRole: text("actor_role").notNull(),
    /** Dotted verb such as "tenant.suspend" or "user.role_change". */
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    outcome: text("outcome", { enum: ["success", "failure"] }).notNull(),
    reason: text("reason"),
    /** Redacted before/after values; never secrets. */
    changes: jsonb("changes"),
    requestId: text("request_id"),
    ipAddress: text("ip_address"),
  },
  (table) => [
    check("audit_logs_outcome", sql`${table.outcome} in ('success', 'failure')`),
    index("audit_logs_occurred_at_idx").on(table.occurredAt.desc()),
    index("audit_logs_target_idx").on(table.targetType, table.targetId),
  ],
);
