import { relations, sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { businesses } from "./businesses.js";
import { id, timestamps } from "./columns.js";

/** A business's saved client. Archived rather than deleted (D010). */
export const clients = pgTable(
  "clients",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    companyName: text("company_name"),
    address: text("address"),
    kraPin: text("kra_pin"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    // Target for composite foreign keys that keep invoices within one business.
    unique("clients_id_business_id_unique").on(table.id, table.businessId),
    index("clients_business_id_name_idx").on(table.businessId, table.name),
    check("clients_phone_format", sql`${table.phone} ~ '^\\+254[17][0-9]{8}$'`),
  ],
);

export const clientsRelations = relations(clients, ({ one }) => ({
  business: one(businesses, { fields: [clients.businessId], references: [businesses.id] }),
}));
