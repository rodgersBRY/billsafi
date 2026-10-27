import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { id, timestamps } from "./columns.js";

/**
 * Internal support cases (D065). Only admins see them; they never hold invoice contents.
 * The account is the owner's user id. Cases are never deleted, so the foreign keys stay
 * plain: removing a user with support history is refused, like audit history.
 */
export const supportCases = pgTable(
  "support_cases",
  {
    id: id(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    category: text("category", {
      enum: ["billing", "sign_in", "invoices", "payments", "bug", "other"],
    }).notNull(),
    severity: text("severity", { enum: ["low", "normal", "high", "urgent"] })
      .notNull()
      .default("normal"),
    status: text("status", { enum: ["open", "waiting", "resolved"] })
      .notNull()
      .default("open"),
    assignedTo: uuid("assigned_to").references(() => users.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolution: text("resolution"),
  },
  (table) => [
    check(
      "support_cases_category",
      sql`${table.category} in ('billing', 'sign_in', 'invoices', 'payments', 'bug', 'other')`,
    ),
    check("support_cases_severity", sql`${table.severity} in ('low', 'normal', 'high', 'urgent')`),
    check("support_cases_status", sql`${table.status} in ('open', 'waiting', 'resolved')`),
    // A case is resolved exactly when it has a resolution and a resolved time.
    check(
      "support_cases_resolved_fields",
      sql`(${table.status} = 'resolved') = (${table.resolvedAt} is not null and ${table.resolution} is not null)
        and (${table.status} = 'resolved' or (${table.resolvedAt} is null and ${table.resolution} is null))`,
    ),
    // Lets a note's (case, account) pair be checked against its case.
    unique("support_cases_id_account_key").on(table.id, table.accountId),
    index("support_cases_account_idx").on(table.accountId),
    index("support_cases_status_updated_idx").on(table.status, table.updatedAt.desc()),
  ],
);

/**
 * Append-only notes on a case, or loose on an account (case_id null). A trigger in the
 * migration rejects UPDATE, DELETE and TRUNCATE; a mistaken note is answered by a new one.
 */
export const supportNotes = pgTable(
  "support_notes",
  {
    id: id(),
    caseId: uuid("case_id"),
    accountId: uuid("account_id")
      .notNull()
      .references(() => users.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A note on a case must name the case's own account (skipped for loose notes).
    foreignKey({
      columns: [table.caseId, table.accountId],
      foreignColumns: [supportCases.id, supportCases.accountId],
      name: "support_notes_case_account_fk",
    }),
    index("support_notes_case_idx").on(table.caseId, table.createdAt),
    index("support_notes_account_idx").on(table.accountId, table.createdAt.desc()),
  ],
);
