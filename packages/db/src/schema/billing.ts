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
  uniqueIndex,
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

/** How a manually recorded plan payment reached Billsafi. */
export const manualPaymentMethods = ["mpesa_direct", "bank_transfer", "cash", "other"] as const;
export type ManualPaymentMethod = (typeof manualPaymentMethods)[number];

/** `provider` of a payment an admin recorded by hand; M-Pesa rows name their provider. */
export const MANUAL_PROVIDER = "manual";

/**
 * One plan payment (D051): an M-Pesa checkout for the platform Paybill, or a payment
 * received some other way and recorded by an admin (`provider` = 'manual', which is
 * always succeeded and names its method, reference, date paid and recorder). Kept
 * separate from the payments freelancers record on their own invoices.
 */
export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    purpose: subscriptionPurpose("purpose").notNull(),
    /** Pro months or credit packs paid for; M-Pesa checkouts buy one. */
    quantity: integer("quantity").notNull().default(1),
    /** In `currency`: KES for M-Pesa, KES or USD for manual payments. */
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("KES"),
    /** The USD list price and the USD to KES rate used to set `amount`. */
    priceUsd: numeric("price_usd", { precision: 14, scale: 2 }),
    usdKesRate: numeric("usd_kes_rate", { precision: 14, scale: 6 }),
    /** The M-Pesa number prompted; null for manual payments. */
    phone: text("phone"),
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
    /**
     * Set when an admin ended Pro before `grantedUntil`: the new end of the run. The
     * window really ran until the later of `grantedFrom` and this; `grantedUntil` keeps
     * what was bought.
     */
    endedEarlyAt: timestamp("ended_early_at", { withTimezone: true }),
    /** For credit packs: invoices added to the account's credit balance. */
    creditsGranted: integer("credits_granted").notNull().default(0),
    /** Manual payments: how it was paid, the payer's reference, and the day it was paid. */
    method: text("method", { enum: manualPaymentMethods }),
    externalReference: text("external_reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** The admin who recorded a manual payment. Never shown to the account. */
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "restrict" }),
    /** An admin's note on a manual payment. Never shown to the account. */
    note: text("note"),
    ...timestamps(),
  },
  (table) => [
    index("subscription_payments_user_created_idx").on(table.userId, table.createdAt),
    check("subscription_payments_amount", sql`${table.amount} > 0`),
    check("subscription_payments_quantity", sql`${table.quantity} between 1 and 12`),
    check("subscription_payments_currency", sql`${table.currency} in ('KES', 'USD')`),
    check(
      "subscription_payments_method",
      sql`${table.method} is null or ${table.method} in ('mpesa_direct', 'bank_transfer', 'cash', 'other')`,
    ),
    check(
      "subscription_payments_phone",
      sql`${table.provider} = 'manual' or ${table.phone} is not null`,
    ),
    check(
      "subscription_payments_manual",
      sql`${table.provider} <> 'manual' or (${table.status} = 'succeeded'
        and ${table.method} is not null and ${table.externalReference} is not null
        and ${table.paidAt} is not null and ${table.recordedBy} is not null)`,
    ),
    // The same payment can't be recorded twice: one reference per method, any letter case.
    uniqueIndex("subscription_payments_manual_reference")
      .on(table.provider, table.method, sql`upper(${table.externalReference})`)
      .where(sql`${table.provider} = 'manual'`),
  ],
);

export const accountGrantKind = pgEnum("account_grant_kind", ["pro_months", "invoice_credits"]);

/**
 * Pro months or invoice credits an admin gave an account at no charge. Gifts have no
 * amount, so they live apart from subscription_payments and never count as revenue.
 * Granted credits join bought ones in the balance (AllowanceService.credits).
 */
export const accountGrants = pgTable(
  "account_grants",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    kind: accountGrantKind("kind").notNull(),
    /** Pro months (1 to 12) or invoice credits (1 to 500). */
    quantity: integer("quantity").notNull(),
    reason: text("reason").notNull(),
    grantedBy: uuid("granted_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** For Pro: the access window this grant added. */
    grantedFrom: timestamp("granted_from", { withTimezone: true }),
    grantedUntil: timestamp("granted_until", { withTimezone: true }),
    /** As on subscription_payments: the run's new end when an admin ended Pro early. */
    endedEarlyAt: timestamp("ended_early_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("account_grants_user_created_idx").on(table.userId, table.createdAt),
    check(
      "account_grants_quantity",
      sql`(${table.kind} = 'pro_months' and ${table.quantity} between 1 and 12
        and ${table.grantedFrom} is not null and ${table.grantedUntil} is not null)
      or (${table.kind} = 'invoice_credits' and ${table.quantity} between 1 and 500)`,
    ),
  ],
);

/**
 * A time-limited raise of the account's invoice allowance, set by an admin. While active
 * (starts_at <= now < expires_at, not revoked) its extra invoices are added to the plan
 * limit of whatever allowance window applies. Expiry is required so nothing stays raised
 * by accident; revoking keeps the row for history.
 */
export const allowanceOverrides = pgTable(
  "allowance_overrides",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    extraInvoices: integer("extra_invoices").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    reason: text("reason").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => users.id, { onDelete: "restrict" }),
    revokeReason: text("revoke_reason"),
  },
  (table) => [
    index("allowance_overrides_user_idx").on(table.userId, table.expiresAt),
    check("allowance_overrides_extra", sql`${table.extraInvoices} between 1 and 1000`),
    check("allowance_overrides_window", sql`${table.expiresAt} > ${table.startsAt}`),
    check(
      "allowance_overrides_revoked",
      sql`(${table.revokedAt} is null) = (${table.revokedBy} is null)`,
    ),
  ],
);

export const subscriptionEventKind = pgEnum("subscription_event_kind", [
  "activated",
  "renewed",
  "credits_added",
  "cancelled",
  "cancellation_undone",
  /** An admin gave Pro months or invoice credits at no charge. */
  "granted",
  /** An admin cut prepaid months so Pro ends at the end of the current Pro month. */
  "ended_by_admin",
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
    grantId: uuid("grant_id").references(() => accountGrants.id, { onDelete: "restrict" }),
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
