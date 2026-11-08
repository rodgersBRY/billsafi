import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { businesses } from "./businesses.js";
import { id, timestamps } from "./columns.js";

/** A business's reusable line item. Picking one copies it into the document (D080). */
export const savedItems = pgTable(
  "saved_items",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    useCount: integer("use_count").notNull().default(0),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("saved_items_business_description_active_unique")
      .on(table.businessId, sql`lower(${table.description})`)
      .where(sql`${table.archivedAt} is null`),
    index("saved_items_business_use_idx").on(table.businessId, table.useCount),
    check("saved_items_quantity_positive", sql`${table.quantity} > 0`),
    check("saved_items_unit_price_non_negative", sql`${table.unitPrice} >= 0`),
  ],
);

export const savedItemsRelations = relations(savedItems, ({ one }) => ({
  business: one(businesses, { fields: [savedItems.businessId], references: [businesses.id] }),
}));
