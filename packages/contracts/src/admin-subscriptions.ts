import { nairobiDate } from "@billsafi/domain";
import { z } from "zod";
import { subscriptionStatuses } from "@billsafi/domain";
import {
  type AdminAccountStatus,
  type AdminPlan,
  type AdminSubscriptionStatus,
  reasonSchema,
} from "./admin.js";
import type { SubscriptionPaymentStatus, SubscriptionPurpose } from "./billing.js";
import {
  blankToUndefined as blankParam,
  optionalDate,
  optionalDays,
  optionalEnum,
  pageParam,
  searchParam,
  sortDirParam,
} from "./query-params.js";

/*
 * Super admin phase 3: subscription actions and lists. Money is a 2dp string in the
 * payment's own currency (never converted), dates are ISO instants unless noted.
 */

/** How a manually recorded plan payment reached Billsafi. */
export const manualPaymentMethods = ["mpesa_direct", "bank_transfer", "cash", "other"] as const;
export type ManualPaymentMethod = (typeof manualPaymentMethods)[number];

/** Manual payments are taken in either currency and stored as received. */
export const manualPaymentCurrencies = ["KES", "USD"] as const;
export type ManualPaymentCurrency = (typeof manualPaymentCurrencies)[number];

/** Where a plan payment came from: an M-Pesa checkout, or recorded by an admin. */
export const planPaymentProviders = ["mpesa", "manual"] as const;
export type PlanPaymentProvider = (typeof planPaymentProviders)[number];

export const ADMIN_PAYMENT_MAX_MONTHS = 12;
export const ADMIN_PAYMENT_MAX_PACKS = 10;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 100;

/** The optional `Idempotency-Key` header on actions that add money or gifts. */
export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1, "The Idempotency-Key header can't be blank")
  .max(
    IDEMPOTENCY_KEY_MAX_LENGTH,
    `Keep the Idempotency-Key under ${IDEMPOTENCY_KEY_MAX_LENGTH} characters`,
  );

const amountSchema = z
  .string({ error: "Enter the amount paid" })
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter an amount like 520 or 520.00")
  .refine((value) => Number(value) > 0, "The amount must be more than zero")
  .transform((value) => Number(value).toFixed(2));

const blankToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const paymentFields = {
  amount: amountSchema,
  currency: z.enum(manualPaymentCurrencies, { error: "Choose KES or USD" }),
  method: z.enum(manualPaymentMethods, { error: "Choose how it was paid" }),
  /** The payer's reference: an M-Pesa code, bank reference or receipt number. */
  reference: z
    .string({ error: "Enter the payment reference" })
    .trim()
    .min(1, "Enter the payment reference")
    .max(100, "Keep the reference under 100 characters"),
  /**
   * The Nairobi calendar day it was paid, YYYY-MM-DD. Not in the future; the API also
   * refuses a day before the account was created.
   */
  paidAt: z.iso
    .date({ error: "Enter the date paid as YYYY-MM-DD" })
    .refine((day) => day <= nairobiDate(new Date()), "The payment date can't be in the future"),
  /** Kept for admins only; the account never sees it. */
  note: z.preprocess(
    blankToUndefined,
    z.string().trim().max(500, "Keep the note under 500 characters").optional(),
  ),
  reason: reasonSchema,
};

/**
 * A payment received outside M-Pesa checkout, recorded by an admin. Pro months are added
 * one by one with the same rule as an M-Pesa payment; credit packs add 50 invoices each.
 */
export const adminRecordPaymentSchema = z.discriminatedUnion(
  "purpose",
  [
    z.object({
      purpose: z.literal("pro_month"),
      months: z.int().min(1).max(ADMIN_PAYMENT_MAX_MONTHS),
      ...paymentFields,
    }),
    z.object({
      purpose: z.literal("invoice_credits"),
      packs: z.int().min(1).max(ADMIN_PAYMENT_MAX_PACKS),
      ...paymentFields,
    }),
  ],
  { error: "Choose Pro months or invoice credits" },
);
export type AdminRecordPaymentInput = z.input<typeof adminRecordPaymentSchema>;
export type AdminRecordPayment = z.output<typeof adminRecordPaymentSchema>;

/** The account's plan right after an action, read inside the action's transaction. */
export interface AdminSubscriptionState {
  plan: AdminPlan;
  status: AdminSubscriptionStatus;
  /** Start of the latest run of paid months. */
  anchorAt: string | null;
  paidMonths: number;
  /** End of the latest run of paid months, also when it has lapsed. */
  paidUntil: string | null;
  cancelledAt: string | null;
  /** Bought plus granted invoice credits, minus those used. */
  credits: number;
}

export interface AdminPaymentRecorded {
  paymentId: string;
  /** True when this answer replays an earlier request with the same Idempotency-Key. */
  replayed: boolean;
  subscription: AdminSubscriptionState;
}

/** A plan payment as the admin sees it: M-Pesa checkouts and manual payments alike. */
export interface AdminPlanPayment {
  id: string;
  createdAt: string;
  /** When it succeeded in Billsafi: the M-Pesa confirmation, or when it was recorded. */
  confirmedAt: string | null;
  userId: string;
  userEmail: string;
  purpose: SubscriptionPurpose;
  /** Pro months or credit packs; M-Pesa checkouts buy one. */
  quantity: number;
  /** In `currency`, as paid. */
  amount: string;
  currency: ManualPaymentCurrency;
  /** USD list price at checkout; null for manual payments and old checkouts. */
  priceUsd: string | null;
  status: SubscriptionPaymentStatus;
  provider: PlanPaymentProvider;
  /** Manual payments only. */
  method: ManualPaymentMethod | null;
  /** Middle digits hidden, like +2547•••••678; null for manual payments. */
  phone: string | null;
  /** The M-Pesa receipt from checkout. */
  receipt: string | null;
  /** Manual payments: the payer's reference. */
  externalReference: string | null;
  /** Manual payments: the Nairobi day it was paid, YYYY-MM-DD. */
  paidOn: string | null;
  /** Manual payments: the admin who recorded it. */
  recordedBy: { id: string; email: string | null } | null;
  note: string | null;
  /** M-Pesa's reason, for failed payments only. */
  resultDescription: string | null;
  /**
   * Pro payments: the access window added. `grantedUntil` is when it really ended: earlier
   * than bought when an admin ended Pro early, which `endedEarly` marks.
   */
  grantedFrom: string | null;
  grantedUntil: string | null;
  endedEarly: boolean;
  creditsGranted: number;
}

export const accountGrantKinds = ["pro_months", "invoice_credits"] as const;
export type AccountGrantKind = (typeof accountGrantKinds)[number];

export const ADMIN_GRANT_MAX_MONTHS = 12;
export const ADMIN_GRANT_MAX_CREDITS = 500;

/**
 * A gift at no charge: Pro months (added with the same rule as a payment) or invoice
 * credits. Gifts never count as revenue.
 */
export const adminGrantSchema = z.discriminatedUnion(
  "kind",
  [
    z.object({
      kind: z.literal("pro_months"),
      quantity: z.int().min(1).max(ADMIN_GRANT_MAX_MONTHS),
      reason: reasonSchema,
    }),
    z.object({
      kind: z.literal("invoice_credits"),
      quantity: z.int().min(1).max(ADMIN_GRANT_MAX_CREDITS),
      reason: reasonSchema,
    }),
  ],
  { error: "Choose Pro months or invoice credits" },
);
export type AdminGrantInput = z.input<typeof adminGrantSchema>;
export type AdminGrant = z.output<typeof adminGrantSchema>;

export interface AdminGrantRecorded {
  grantId: string;
  /** True when this answer replays an earlier request with the same Idempotency-Key. */
  replayed: boolean;
  subscription: AdminSubscriptionState;
}

/** `POST /admin/tenants/:id/end-pro` takes just a reason (adminActionBodySchema). */
export interface AdminProEnded {
  /** Pro runs until `subscription.paidUntil`, the end of the current Pro month. */
  subscription: AdminSubscriptionState;
}

export const ADMIN_OVERRIDE_MAX_EXTRA = 1000;
/** An override can run until at most this many days from now (a year, leap day included). */
export const ADMIN_OVERRIDE_MAX_DAYS = 366;
/** How far in the past a start time may be, for clocks that disagree a little. */
const START_SKEW_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const instant = (message: string) => z.iso.datetime({ offset: true, error: message });

/**
 * Raises the account's invoice limit by `extraInvoices` from `startsAt` (default now)
 * until `expiresAt`, on top of whatever plan applies. An expiry is required.
 */
export const adminOverrideSchema = z
  .object({
    extraInvoices: z.int().min(1).max(ADMIN_OVERRIDE_MAX_EXTRA),
    startsAt: z.preprocess(
      blankToUndefined,
      instant("Enter the start as an ISO date and time").optional(),
    ),
    expiresAt: instant("Enter the expiry as an ISO date and time"),
    reason: reasonSchema,
  })
  .superRefine((value, context) => {
    const now = Date.now();
    const starts = value.startsAt ? Date.parse(value.startsAt) : now;
    const expires = Date.parse(value.expiresAt);
    if (value.startsAt && starts < now - START_SKEW_MS) {
      context.addIssue({
        code: "custom",
        path: ["startsAt"],
        message: "The start can't be in the past",
      });
    }
    if (expires <= starts) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "The expiry must be after the start",
      });
    }
    if (expires > now + ADMIN_OVERRIDE_MAX_DAYS * DAY_MS) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "An override can last at most a year from now",
      });
    }
  });
export type AdminOverrideInput = z.input<typeof adminOverrideSchema>;
export type AdminOverride = z.output<typeof adminOverrideSchema>;

/** scheduled: starts later. active: raising the limit now. expired, revoked: no longer. */
export const adminOverrideStates = ["scheduled", "active", "expired", "revoked"] as const;
export type AdminOverrideState = (typeof adminOverrideStates)[number];

export interface AdminOverrideRow {
  id: string;
  userId: string;
  userEmail: string;
  extraInvoices: number;
  startsAt: string;
  expiresAt: string;
  state: AdminOverrideState;
  reason: string;
  createdAt: string;
  createdBy: { id: string; email: string | null };
  revokedAt: string | null;
  revokedBy: { id: string; email: string | null } | null;
  revokeReason: string | null;
}

export interface AdminOverrideResult {
  override: AdminOverrideRow;
  /** The account's allowance window right after the change. */
  allowance: { plan: "free" | "pro"; used: number; limit: number; periodEnd: string };
}

/*
 * Admin read routes for subscriptions (GET, cached 60 seconds, cleared by any action).
 */

export const ADMIN_SUBSCRIPTIONS_PAGE_SIZE = 25;
export const ADMIN_PLAN_PAYMENTS_PAGE_SIZE = 50;
export const ADMIN_GRANTS_PAGE_SIZE = 50;
export const ADMIN_OVERRIDES_PAGE_SIZE = 50;

export const adminSubscriptionSorts = ["registered", "proUntil", "lastPayment", "name"] as const;
export type AdminSubscriptionSort = (typeof adminSubscriptionSorts)[number];

/** "true" or "false" in a query string; blank means either. */
const optionalBoolean = z.preprocess(
  blankParam,
  z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
);

/** Nairobi days: `from` the start of one, `to` the end of another. */
const dateRangeFields = { from: optionalDate, to: optionalDate };
const fromBeforeTo: [
  (query: { from?: string; to?: string }) => boolean,
  { message: string; path: string[] },
] = [
  (query) => !query.from || !query.to || query.from <= query.to,
  { message: "The start date must not be after the end date", path: ["to"] },
];

export const adminSubscriptionsQuerySchema = z.object({
  page: pageParam,
  /** Owner name or email, or an exact account id. */
  search: searchParam,
  subscriptionStatus: optionalEnum(subscriptionStatuses),
  /** On Pro, with access ending within N days. */
  renewalWithin: optionalDays([7, 30]),
  /** Pro ended within the last N days. */
  lapsedWithin: optionalDays([30]),
  /** With (true) or without (false) a limit override active now. */
  hasOverride: optionalBoolean,
  sort: z.preprocess(blankParam, z.enum(adminSubscriptionSorts).default("registered")),
  dir: sortDirParam,
});
export type AdminSubscriptionsQuery = z.output<typeof adminSubscriptionsQuerySchema>;

/**
 * Who paid for the Pro month in progress: the latest payment or grant whose window covers
 * now. "paid" also when no extension row covers it (Pro set up before phase 3); null off Pro.
 */
export type AdminCurrentMonthSource = "paid" | "complimentary";

export interface AdminSubscriptionRow {
  /** The account id, which is the owner's user id. */
  id: string;
  owner: { name: string; email: string };
  accountStatus: AdminAccountStatus;
  plan: AdminPlan;
  subscriptionStatus: AdminSubscriptionStatus;
  /** End of the latest run of paid months, also once lapsed; null if never on Pro. */
  proUntil: string | null;
  cancelledAt: string | null;
  currentMonthSource: AdminCurrentMonthSource | null;
  /** The latest succeeded plan payment, dated by when it was paid. */
  lastPayment: {
    date: string;
    amount: string;
    currency: ManualPaymentCurrency;
    provider: PlanPaymentProvider;
  } | null;
  /** Bought plus granted credits, minus those used. */
  credits: number;
  /** Overrides raising the limit now, and their extra invoices combined. */
  activeOverrides: { count: number; extraInvoices: number };
  registeredAt: string;
}

export interface AdminSubscriptionsPage {
  page: number;
  pageSize: number;
  total: number;
  subscriptions: AdminSubscriptionRow[];
  generatedAt: string;
}

export const adminPlanPaymentsQuerySchema = z
  .object({
    page: pageParam,
    /** Account email, or an exact account id. */
    search: searchParam,
    provider: optionalEnum(planPaymentProviders),
    status: optionalEnum(["pending", "succeeded", "failed"]),
    method: optionalEnum(manualPaymentMethods),
    ...dateRangeFields,
  })
  .refine(...fromBeforeTo);
export type AdminPlanPaymentsQuery = z.output<typeof adminPlanPaymentsQuerySchema>;

export interface AdminPlanPaymentsPage {
  page: number;
  pageSize: number;
  total: number;
  /** Newest first, by when the row was created. */
  payments: AdminPlanPayment[];
  generatedAt: string;
}

export interface AdminGrantRow {
  id: string;
  userId: string;
  userEmail: string;
  kind: AccountGrantKind;
  quantity: number;
  reason: string;
  grantedBy: { id: string; email: string | null };
  /** For Pro: the access window this grant added, cut short when `endedEarly`. */
  grantedFrom: string | null;
  grantedUntil: string | null;
  endedEarly: boolean;
  createdAt: string;
}

export const adminGrantsQuerySchema = z
  .object({
    page: pageParam,
    search: searchParam,
    kind: optionalEnum(accountGrantKinds),
    ...dateRangeFields,
  })
  .refine(...fromBeforeTo);
export type AdminGrantsQuery = z.output<typeof adminGrantsQuerySchema>;

export interface AdminGrantsPage {
  page: number;
  pageSize: number;
  total: number;
  /** Newest first. */
  grants: AdminGrantRow[];
  generatedAt: string;
}

export const adminOverridesQuerySchema = z.object({
  page: pageParam,
  search: searchParam,
  state: optionalEnum(adminOverrideStates),
});
export type AdminOverridesQuery = z.output<typeof adminOverridesQuerySchema>;

export interface AdminOverridesPage {
  page: number;
  pageSize: number;
  total: number;
  /** Newest first. */
  overrides: AdminOverrideRow[];
  generatedAt: string;
}
