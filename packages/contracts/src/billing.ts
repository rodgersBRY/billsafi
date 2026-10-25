import { z } from "zod";
import { mpesaPhone } from "./fields.js";
import type { AllowanceUsage } from "./invoices.js";

export const subscriptionPurposes = ["pro_month", "invoice_credits"] as const;
export type SubscriptionPurpose = (typeof subscriptionPurposes)[number];

/** Starting an M-Pesa STK Push for one Pro month or one credit pack (D051). */
export const checkoutSchema = z.object({
  purpose: z.enum(subscriptionPurposes),
  phone: mpesaPhone,
});
export type CheckoutInput = z.input<typeof checkoutSchema>;
export type Checkout = z.output<typeof checkoutSchema>;

export type SubscriptionPaymentStatus = "pending" | "succeeded" | "failed";

export interface SubscriptionPayment {
  id: string;
  purpose: SubscriptionPurpose;
  /** "mpesa" for checkouts; "manual" for a payment Billsafi recorded on the account's behalf. */
  source: "mpesa" | "manual";
  /** How a manual payment was made; null for checkouts. */
  method: "mpesa_direct" | "bank_transfer" | "cash" | "other" | null;
  /** Pro months or credit packs paid for. */
  quantity: number;
  /** In `currency`; checkouts are always KES. */
  amount: string;
  currency: "KES" | "USD";
  /** The M-Pesa number prompted; null for a payment Billsafi recorded by hand. */
  phone: string | null;
  status: SubscriptionPaymentStatus;
  receipt: string | null;
  /** Why a payment failed, in the provider's words. */
  resultDescription: string | null;
  createdAt: string;
  confirmedAt: string | null;
  /** When the Pro access this payment added ends; earlier than bought if `endedEarly`. */
  grantedUntil: string | null;
  /** BillSafi ended Pro before this payment's months ran out. */
  endedEarly: boolean;
  creditsGranted: number;
}

/**
 * free: never paid, or paid access ended (`paidUntil` keeps the last date).
 * active: paid access continues. cancelled: paid access continues but will not renew.
 */
export type SubscriptionStatus = "free" | "active" | "cancelled";

export interface PurposePrices {
  pro_month: string;
  invoice_credits: string;
}

/**
 * Plan prices are set in USD. M-Pesa charges the KES amount at the current
 * exchange rate, so `kes` and `usdKesRate` are null while no rate is available.
 */
export interface PlanPrices {
  usd: PurposePrices;
  kes: PurposePrices | null;
  usdKesRate: string | null;
  /** When the rate source last updated the rate. */
  rateUpdatedAt: string | null;
}

export interface BillingOverview {
  usage: AllowanceUsage;
  prices: PlanPrices;
  subscription: {
    status: SubscriptionStatus;
    paidUntil: string | null;
    cancelledAt: string | null;
    /** True in the last days before paid access ends while it will not renew by itself. */
    renewalDue: boolean;
  };
  pendingPayment: SubscriptionPayment | null;
  payments: SubscriptionPayment[];
  /** Pro months and invoice credits Billsafi gave at no charge, newest first. */
  grants: BillingGrant[];
}

/** A complimentary grant as the account sees it: no admin name, no internal reason. */
export interface BillingGrant {
  id: string;
  kind: "pro_months" | "invoice_credits";
  /** Pro months or invoice credits. */
  quantity: number;
  createdAt: string;
  /** For Pro: when the access this grant added ends; earlier than given if `endedEarly`. */
  grantedUntil: string | null;
  endedEarly: boolean;
}
