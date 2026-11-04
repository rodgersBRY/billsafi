import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { id } from "./columns.js";

/**
 * Check-in emails sent to quiet accounts (D069). A row is claimed before sending and
 * removed if the send fails, so each step goes out once per quiet spell.
 */
export const reengagementEmails = pgTable(
  "reengagement_emails",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    segment: text("segment").notNull(),
    step: integer("step").notNull(),
    /** Start of the quiet spell this email belongs to. */
    quietSince: timestamp("quiet_since", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("reengagement_emails_spell_step_unique").on(table.userId, table.quietSince, table.step),
    index("reengagement_emails_sent_idx").on(table.sentAt),
    check(
      "reengagement_emails_segment",
      sql`${table.segment} in ('no_business', 'no_invoice', 'lapsed')`,
    ),
    check("reengagement_emails_step", sql`${table.step} between 1 and 3`),
  ],
);

/**
 * Accounts that asked for no check-in emails. Account emails such as password resets and
 * renewal reminders still go out.
 */
export const emailOptOuts = pgTable("email_opt_outs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
