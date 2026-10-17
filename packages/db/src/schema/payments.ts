import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
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
import { id, timestamps } from "./columns.js";
import { invoices } from "./invoices.js";

export const receivedPaymentMethod = pgEnum("received_payment_method", [
  "mpesa",
  "bank_transfer",
  "other",
]);

/** A payment the freelancer received outside TallyNest and recorded manually (D002). */
export const invoicePayments = pgTable(
  "invoice_payments",
  {
    id: id(),
    businessId: uuid("business_id").notNull(),
    invoiceId: uuid("invoice_id").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    method: receivedPaymentMethod("method").notNull(),
    /** When the client paid; dashboard receipts use this, not the recording time. */
    paymentDate: date("payment_date").notNull(),
    reference: text("reference"),
    recordedByUserId: uuid("recorded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** Reversed payments are kept and excluded from totals (D043). */
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      name: "invoice_payments_invoice_same_business_fk",
      columns: [table.invoiceId, table.businessId],
      foreignColumns: [invoices.id, invoices.businessId],
    }).onDelete("restrict"),
    unique("invoice_payments_id_business_id_unique").on(table.id, table.businessId),
    index("invoice_payments_invoice_idx").on(table.invoiceId),
    index("invoice_payments_business_date_idx").on(table.businessId, table.paymentDate),
    check("invoice_payments_amount_positive", sql`${table.amount} > 0`),
  ],
);

export const paymentChangeKind = pgEnum("payment_change_kind", ["correction", "reversal"]);

export type PaymentValues = {
  amount: string;
  method: "mpesa" | "bank_transfer" | "other";
  paymentDate: string;
  reference: string | null;
};

/** Audit trail for corrections and reversals; rows are only ever inserted. */
export const paymentChanges = pgTable(
  "payment_changes",
  {
    id: id(),
    businessId: uuid("business_id").notNull(),
    paymentId: uuid("payment_id").notNull(),
    kind: paymentChangeKind("kind").notNull(),
    previousValues: jsonb("previous_values").$type<PaymentValues>().notNull(),
    newValues: jsonb("new_values").$type<PaymentValues>(),
    reason: text("reason").notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "payment_changes_payment_same_business_fk",
      columns: [table.paymentId, table.businessId],
      foreignColumns: [invoicePayments.id, invoicePayments.businessId],
    }).onDelete("restrict"),
    index("payment_changes_payment_idx").on(table.paymentId),
    check("payment_changes_reason_present", sql`length(trim(${table.reason})) > 0`),
    check(
      "payment_changes_new_values_shape",
      sql`(${table.kind} = 'correction') = (${table.newValues} is not null)`,
    ),
  ],
);

/** Public invoice links. Only a hash of the token is stored (D026, D049). */
export const invoiceLinks = pgTable(
  "invoice_links",
  {
    id: id(),
    businessId: uuid("business_id").notNull(),
    invoiceId: uuid("invoice_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "invoice_links_invoice_same_business_fk",
      columns: [table.invoiceId, table.businessId],
      foreignColumns: [invoices.id, invoices.businessId],
    }).onDelete("cascade"),
    index("invoice_links_invoice_idx").on(table.invoiceId),
    check("invoice_links_window", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);

export const invoicePaymentsRelations = relations(invoicePayments, ({ one, many }) => ({
  invoice: one(invoices, { fields: [invoicePayments.invoiceId], references: [invoices.id] }),
  changes: many(paymentChanges),
}));

export const paymentChangesRelations = relations(paymentChanges, ({ one }) => ({
  payment: one(invoicePayments, {
    fields: [paymentChanges.paymentId],
    references: [invoicePayments.id],
  }),
}));
