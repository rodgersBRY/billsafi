import { sql } from "drizzle-orm";
import { jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.js";

/**
 * Idempotency-Key values sent with admin actions that add money or gifts, so a retried
 * request replays the first result instead of recording it twice. Keys are per admin;
 * `request_hash` covers the action, target and body, so reusing a key for a different
 * request is refused. Written in the action's own transaction, so only committed actions
 * leave a key. Rows are small; old ones can be deleted at any time.
 */
export const adminIdempotencyKeys = pgTable(
  "admin_idempotency_keys",
  {
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    action: text("action").notNull(),
    requestHash: text("request_hash").notNull(),
    /** The action's response, replayed for a repeat of the same request. */
    response: jsonb("response"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [primaryKey({ columns: [table.adminUserId, table.key] })],
);
