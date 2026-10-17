import { relations, sql } from "drizzle-orm";
import {
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { businesses } from "./businesses.js";
import { clients } from "./clients.js";
import { id, timestamps } from "./columns.js";

/** Monetary amounts: numeric(14,2). Quantities: numeric(12,2) (D048). */
const amount = (name: string) => numeric(name, { precision: 14, scale: 2 });

export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "ready",
  "partially_paid",
  "paid",
  "cancelled",
]);

export const discountType = pgEnum("discount_type", ["fixed", "percentage"]);

/** Copied when an invoice is first marked Ready (D048). Shapes live in @billsafi/contracts. */
export type ClientSnapshot = {
  name: string;
  phone: string;
  email: string | null;
  companyName: string | null;
  address: string | null;
  kraPin: string | null;
};

export type BusinessSnapshot = {
  displayName: string;
  contactEmail: string;
  phone: string;
  address: string | null;
  kraPin: string | null;
  logoKey: string | null;
};

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    clientId: uuid("client_id").notNull(),
    status: invoiceStatus("status").notNull().default("draft"),
    /** Assigned on first transition to Ready; never reused. */
    sequenceNumber: integer("sequence_number"),
    invoiceNumber: text("invoice_number"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("KES"),
    discountType: discountType("discount_type"),
    discountValue: amount("discount_value"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }),
    subtotal: amount("subtotal").notNull().default("0"),
    discountAmount: amount("discount_amount").notNull().default("0"),
    taxAmount: amount("tax_amount").notNull().default("0"),
    total: amount("total").notNull().default("0"),
    paymentInstructions: text("payment_instructions"),
    notes: text("notes"),
    clientSnapshot: jsonb("client_snapshot").$type<ClientSnapshot>(),
    businessSnapshot: jsonb("business_snapshot").$type<BusinessSnapshot>(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    /**
     * Set when the first payment is recorded and never cleared. Financial fields
     * stay locked from then on, even if every payment is reversed (D043).
     */
    paymentActivityAt: timestamp("payment_activity_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    // The client must belong to the same business as the invoice.
    foreignKey({
      name: "invoices_client_same_business_fk",
      columns: [table.clientId, table.businessId],
      foreignColumns: [clients.id, clients.businessId],
    }).onDelete("restrict"),
    unique("invoices_id_business_id_unique").on(table.id, table.businessId),
    unique("invoices_business_sequence_unique").on(table.businessId, table.sequenceNumber),
    unique("invoices_business_number_unique").on(table.businessId, table.invoiceNumber),
    index("invoices_business_status_due_idx").on(table.businessId, table.status, table.dueDate),
    index("invoices_business_client_idx").on(table.businessId, table.clientId),
    check("invoices_due_after_issue", sql`${table.dueDate} >= ${table.issueDate}`),
    check(
      "invoices_discount_pair",
      sql`(${table.discountType} is null) = (${table.discountValue} is null)`,
    ),
    check(
      "invoices_number_once_ready",
      sql`(${table.status} = 'draft') = (${table.sequenceNumber} is null)
        and (${table.sequenceNumber} is null) = (${table.invoiceNumber} is null)`,
    ),
    check("invoices_tax_rate_range", sql`${table.taxRate} between 0 and 100`),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: id(),
    businessId: uuid("business_id").notNull(),
    invoiceId: uuid("invoice_id").notNull(),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unitPrice: amount("unit_price").notNull(),
    lineTotal: amount("line_total").notNull(),
  },
  (table) => [
    // Items belong to their invoice's business. Only unissued drafts are ever deleted.
    foreignKey({
      name: "invoice_items_invoice_same_business_fk",
      columns: [table.invoiceId, table.businessId],
      foreignColumns: [invoices.id, invoices.businessId],
    }).onDelete("cascade"),
    unique("invoice_items_invoice_position_unique").on(table.invoiceId, table.position),
    check("invoice_items_quantity_positive", sql`${table.quantity} > 0`),
    check("invoice_items_unit_price_non_negative", sql`${table.unitPrice} >= 0`),
  ],
);

/** An allowance window for an account: a Free calendar month or a Pro paid period. */
export const usagePeriods = pgTable(
  "usage_periods",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    planCode: text("plan_code").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    invoiceLimit: integer("invoice_limit").notNull(),
    /** Free-plan invoices from earlier in the month counted against a first Pro period (D044, D051). */
    carriedOver: integer("carried_over").notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    unique("usage_periods_user_plan_start_unique").on(table.userId, table.planCode, table.startsAt),
    check("usage_periods_window", sql`${table.endsAt} > ${table.startsAt}`),
  ],
);

export const issuanceSource = pgEnum("issuance_source", ["plan", "credit"]);

/** One row per invoice that has ever been made Ready; never removed (D019). */
export const invoiceIssuances = pgTable(
  "invoice_issuances",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .unique()
      .references(() => invoices.id, { onDelete: "restrict" }),
    usagePeriodId: uuid("usage_period_id")
      .notNull()
      .references(() => usagePeriods.id, { onDelete: "restrict" }),
    /** Whether the plan allowance or a purchased invoice credit paid for this issuance (D051). */
    source: issuanceSource("source").notNull().default("plan"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("invoice_issuances_user_issued_at_idx").on(table.userId, table.issuedAt)],
);

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  business: one(businesses, { fields: [invoices.businessId], references: [businesses.id] }),
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
}));
