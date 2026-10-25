import { nairobiDate } from "@billsafi/domain";
import { z } from "zod";
import { type AdminPlan, type AdminSubscriptionStatus, reasonSchema } from "./admin.js";
import type { SubscriptionPaymentStatus, SubscriptionPurpose } from "./billing.js";

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
  /** Pro payments: the access window added. */
  grantedFrom: string | null;
  grantedUntil: string | null;
  creditsGranted: number;
}
