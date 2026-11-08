import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { id, timestamps } from "./columns.js";

/** Product update entries written by admins (D084). Null published_at is a draft. */
export const whatsNewEntries = pgTable(
  "whats_new_entries",
  {
    id: id(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** An app page under /[businessId]/, checked by the contract. */
    linkSegment: text("link_segment"),
    pro: boolean("pro").notNull().default(false),
    popup: boolean("popup").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Kept when the admin account is deleted. */
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (table) => [index("whats_new_entries_published_at_idx").on(table.publishedAt.desc())],
);

/** When each user last opened the panel. No row means never: use the sign-up time. */
export const userWhatsNew = pgTable("user_whats_new", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  seenAt: timestamp("seen_at", { withTimezone: true }).notNull(),
  ...timestamps(),
});
