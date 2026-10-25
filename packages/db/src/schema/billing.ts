import { sql } from "drizzle-orm";
import {
  check,
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
import { id, timestamps } from "./columns.js";

/**
 * The account's Pro entitlement (D018, D044). One row per account, created on
 * first use; Free accounts have a row with no anchor. Paid access runs from
 * `anchorAt` for `paidMonths` anniversary months, so renewals never move the
 * anniversary day. The row is also the account-wide lock for allowance checks.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "restrict" }),
    /** Start of the current run of paid months; replaced when Pro restarts after expiry. */
    anchorAt: timestamp("anchor_at", { withTimezone: true }),
    paidMonths: integer("paid_months").notNull().default(0),
    /**
     * When the latest run of paid months ends: addNairobiMonths(anchorAt, paidMonths).
     * Only the billing service writes it, every time it changes the anchor or months, so
     * admin SQL can read one stored value instead of repeating the Pro rule.
     */
    paidUntil: timestamp("paid_until", { withTimezone: true }),
    /** Set while the account has asked not to continue after paid access (D044). */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    check("subscriptions_paid_months", sql`${table.paidMonths} >= 0`),
    check(
      "subscriptions_paid_until",
      sql`(${table.anchorAt} is null) = (${table.paidUntil} is null)`,
    ),
  ],
);

export const subscriptionPurpose = pgEnum("subscription_purpose", ["pro_month", "invoice_credits"]);

export const subscriptionPaymentStatus = pgEnum("subscription_payment_status", [
  "pending",
  "succeeded",
  "failed",
]);

/**
 * One M-Pesa checkout for the platform Paybill (D051). Kept separate from the
 * payments freelancers record on their own invoices.
 */
export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    purpose: subscriptionPurpose("purpose").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("KES"),
    /** The USD list price and the USD to KES rate used to set `amount`. */
    priceUsd: numeric("price_usd", { precision: 14, scale: 2 }),
    usdKesRate: numeric("usd_kes_rate", { precision: 14, scale: 6 }),
    phone: text("phone").notNull(),
    status: subscriptionPaymentStatus("status").notNull().default("pending"),
    provider: text("provider").notNull(),
    merchantRequestId: text("merchant_request_id"),
    checkoutRequestId: text("checkout_request_id").unique(),
    /** The M-Pesa transaction code; unique so one payment is never applied twice. */
    receipt: text("receipt").unique(),
    resultCode: text("result_code"),
    resultDescription: text("result_description"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /** For Pro: the paid access window this payment granted. */
    grantedFrom: timestamp("granted_from", { withTimezone: true }),
    grantedUntil: timestamp("granted_until", { withTimezone: true }),
    /** For credit packs: invoices added to the account's credit balance. */
    creditsGranted: integer("credits_granted").notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    index("subscription_payments_user_created_idx").on(table.userId, table.createdAt),
    check("subscription_payments_amount", sql`${table.amount} > 0`),
  ],
);

export const subscriptionEventKind = pgEnum("subscription_event_kind", [
  "activated",
  "renewed",
  "credits_added",
  "cancelled",
  "cancellation_undone",
]);

/** Plan history; cancellations and undos are recorded, never deleted (D044). */
export const subscriptionEvents = pgTable(
  "subscription_events",
  {
    id: id(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "restrict" }),
    kind: subscriptionEventKind("kind").notNull(),
    paymentId: uuid("payment_id").references(() => subscriptionPayments.id, {
      onDelete: "restrict",
    }),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("subscription_events_subscription_idx").on(table.subscriptionId)],
);

export const reminderKind = pgEnum("subscription_reminder_kind", ["before_expiry", "on_expiry"]);

/** Renewal reminders already sent, so each goes out once per expiry date (D051). */
export const subscriptionReminders = pgTable(
  "subscription_reminders",
  {
    id: id(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "restrict" }),
    kind: reminderKind("kind").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("subscription_reminders_once").on(table.subscriptionId, table.kind, table.expiresAt),
  ],
);
