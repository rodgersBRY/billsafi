import { relations, sql } from "drizzle-orm";
import {
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { businesses, recurringMode } from "./businesses.js";
import { clients } from "./clients.js";
import { id, timestamps } from "./columns.js";
import { savedItems } from "./items.js";

const amount = (name: string) => numeric(name, { precision: 14, scale: 2 });

export const recurringFrequency = pgEnum("recurring_frequency", [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);

export const recurringStatus = pgEnum("recurring_status", ["active", "paused", "ended"]);

export const recurringPauseReason = pgEnum("recurring_pause_reason", [
  "user",
  "pro_ended",
  "client_archived",
]);

/** A Pro schedule that turns its template into an invoice each period (D082). */
export const recurringInvoices = pgTable(
  "recurring_invoices",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    clientId: uuid("client_id").notNull(),
    status: recurringStatus("status").notNull().default("active"),
    pausedReason: recurringPauseReason("paused_reason"),
    frequency: recurringFrequency("frequency").notNull(),
    mode: recurringMode("mode").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    maxCount: integer("max_count"),
    generatedCount: integer("generated_count").notNull().default(0),
    /** Occurrence index (0 is the start date) the schedule runs next. */
    nextIndex: integer("next_index").notNull().default(0),
    /** Null once the schedule has ended. */
    nextRunDate: date("next_run_date"),
    paymentTermsDays: integer("payment_terms_days").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("KES"),
    discountType: text("discount_type"),
    discountValue: amount("discount_value"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }),
    paymentInstructions: text("payment_instructions"),
    notes: text("notes"),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      name: "recurring_invoices_client_same_business_fk",
      columns: [table.clientId, table.businessId],
      foreignColumns: [clients.id, clients.businessId],
    }).onDelete("restrict"),
    unique("recurring_invoices_id_business_id_unique").on(table.id, table.businessId),
    index("recurring_invoices_business_idx").on(table.businessId, table.updatedAt),
    index("recurring_invoices_due_idx")
      .on(table.nextRunDate)
      .where(sql`${table.status} <> 'ended'`),
    check(
      "recurring_invoices_end_after_start",
      sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`,
    ),
    check("recurring_invoices_one_end", sql`${table.endDate} is null or ${table.maxCount} is null`),
    check(
      "recurring_invoices_max_count_positive",
      sql`${table.maxCount} is null or ${table.maxCount} > 0`,
    ),
    check("recurring_invoices_terms_range", sql`${table.paymentTermsDays} between 0 and 365`),
    check(
      "recurring_invoices_discount_pair",
      sql`(${table.discountType} is null) = (${table.discountValue} is null)`,
    ),
    check(
      "recurring_invoices_discount_type",
      sql`${table.discountType} is null or ${table.discountType} in ('fixed', 'percentage')`,
    ),
    check(
      "recurring_invoices_paused_reason",
      sql`(${table.status} = 'paused') = (${table.pausedReason} is not null)`,
    ),
  ],
);

export const recurringInvoiceItems = pgTable(
  "recurring_invoice_items",
  {
    id: id(),
    businessId: uuid("business_id").notNull(),
    recurringInvoiceId: uuid("recurring_invoice_id").notNull(),
    position: integer("position").notNull(),
    /** May hold {month} and {year}, filled in for each period. */
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unitPrice: amount("unit_price").notNull(),
    savedItemId: uuid("saved_item_id").references(() => savedItems.id, { onDelete: "set null" }),
  },
  (table) => [
    foreignKey({
      name: "recurring_invoice_items_schedule_same_business_fk",
      columns: [table.recurringInvoiceId, table.businessId],
      foreignColumns: [recurringInvoices.id, recurringInvoices.businessId],
    }).onDelete("cascade"),
    unique("recurring_invoice_items_position_unique").on(table.recurringInvoiceId, table.position),
    check("recurring_invoice_items_quantity_positive", sql`${table.quantity} > 0`),
    check("recurring_invoice_items_unit_price_non_negative", sql`${table.unitPrice} >= 0`),
  ],
);

export const recurringInvoicesRelations = relations(recurringInvoices, ({ one, many }) => ({
  business: one(businesses, {
    fields: [recurringInvoices.businessId],
    references: [businesses.id],
  }),
  client: one(clients, { fields: [recurringInvoices.clientId], references: [clients.id] }),
  items: many(recurringInvoiceItems),
}));

export const recurringInvoiceItemsRelations = relations(recurringInvoiceItems, ({ one }) => ({
  schedule: one(recurringInvoices, {
    fields: [recurringInvoiceItems.recurringInvoiceId],
    references: [recurringInvoices.id],
  }),
}));
