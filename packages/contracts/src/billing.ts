import { z } from "zod";
import { kenyanPhone } from "./fields.js";
import type { AllowanceUsage } from "./invoices.js";

export const subscriptionPurposes = ["pro_month", "invoice_credits"] as const;
export type SubscriptionPurpose = (typeof subscriptionPurposes)[number];

/** Starting an M-Pesa STK Push for one Pro month or one credit pack (D051). */
export const checkoutSchema = z.object({
  purpose: z.enum(subscriptionPurposes),
  phone: kenyanPhone,
});
export type CheckoutInput = z.input<typeof checkoutSchema>;
export type Checkout = z.output<typeof checkoutSchema>;

export type SubscriptionPaymentStatus = "pending" | "succeeded" | "failed";

export interface SubscriptionPayment {
  id: string;
  purpose: SubscriptionPurpose;
  amount: string;
  phone: string;
  status: SubscriptionPaymentStatus;
  receipt: string | null;
  /** Why a payment failed, in the provider's words. */
  resultDescription: string | null;
  createdAt: string;
  confirmedAt: string | null;
  grantedUntil: string | null;
  creditsGranted: number;
}

/**
 * free: never paid, or paid access ended (`paidUntil` keeps the last date).
 * active: paid access continues. cancelled: paid access continues but will not renew.
 */
export type SubscriptionStatus = "free" | "active" | "cancelled";

export interface BillingOverview {
  usage: AllowanceUsage;
  subscription: {
    status: SubscriptionStatus;
    paidUntil: string | null;
    cancelledAt: string | null;
    /** True in the last days before paid access ends while it will not renew by itself. */
    renewalDue: boolean;
  };
  pendingPayment: SubscriptionPayment | null;
  payments: SubscriptionPayment[];
}
