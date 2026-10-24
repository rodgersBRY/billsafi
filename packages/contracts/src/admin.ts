import { z } from "zod";
import type { SubscriptionPaymentStatus, SubscriptionPurpose } from "./billing.js";
import type { InvoiceStatus } from "./invoices.js";

/*
 * Read-only admin dashboard (spec 2026-10-24). Shares and rates are fractions
 * from 0 to 1, money is a 2dp string, dates are ISO instants unless noted.
 */

export const adminFunnelDays = [7, 30, 90] as const;
export type AdminFunnelDays = (typeof adminFunnelDays)[number];

export const adminRetentionWeeks = [4, 8, 12] as const;
export type AdminRetentionWeeks = (typeof adminRetentionWeeks)[number];

export const ADMIN_USERS_PAGE_SIZE = 25;

export const adminFunnelQuerySchema = z.object({
  days: z.coerce.number().pipe(z.literal(adminFunnelDays)).default(30),
});
export type AdminFunnelQuery = z.output<typeof adminFunnelQuerySchema>;

export const adminRetentionQuerySchema = z.object({
  weeks: z.coerce.number().pipe(z.literal(adminRetentionWeeks)).default(8),
});
export type AdminRetentionQuery = z.output<typeof adminRetentionQuerySchema>;

export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // A blank search box means no filter.
  search: z
    .string()
    .trim()
    .max(100)
    .transform((value) => value || undefined)
    .optional(),
});
export type AdminUsersQuery = z.output<typeof adminUsersQuerySchema>;

/** "google" when the account has any Google login, otherwise "email". */
export type AdminSignInMethod = "google" | "email";

export interface AdminSignupCounts {
  total: number;
  google: number;
  email: number;
}

/**
 * Windows end at the moment of the request. "Last 7/30 days" are today plus
 * the 6/29 Nairobi calendar days before it, the same for every tile.
 */
export interface AdminOverview {
  signups: {
    today: AdminSignupCounts;
    last7Days: AdminSignupCounts;
    last30Days: AdminSignupCounts;
  };
  /** Businesses with at least one invoice made Ready in the last 30 Nairobi days. */
  activeBusinesses: number;
  /** This Nairobi calendar month. */
  invoicesCreatedThisMonth: number;
  invoicesReadyThisMonth: number;
  totalAccounts: number;
  /** Accounts whose Pro access has not ended. */
  payingAccounts: number;
  /** Accounts with a succeeded plan payment divided by all accounts; null with no accounts. */
  conversion: number | null;
  /** Paying accounts times the Pro price in USD. */
  mrrUsd: string;
  kesCollectedThisMonth: string;
  /**
   * Succeeded / (succeeded + failed) by checkout time over the last 30 Nairobi
   * days; pending payments are left out. Null with no settled payments.
   */
  mpesaSuccessRate30Days: number | null;
  generatedAt: string;
}

export const adminFunnelSteps = [
  "signed_up",
  "business_created",
  "client_added",
  "invoice_created",
  "invoice_ready",
  "payment_recorded",
] as const;
export type AdminFunnelStepKey = (typeof adminFunnelSteps)[number];

export interface AdminFunnelStep {
  key: AdminFunnelStepKey;
  /** Users from the cohort who reached this step, counted independently of other steps. */
  users: number;
  shareOfSignups: number | null;
  /**
   * 1 - users / previous step's users. Can be negative because steps are
   * counted independently; null for the first step or when the previous step is 0.
   */
  dropFromPrevious: number | null;
  /** Median seconds from signup to the step, among users who reached it. */
  medianSecondsFromSignup: number | null;
}

export interface AdminFunnel {
  days: AdminFunnelDays;
  /** Start of the signup window. */
  since: string;
  steps: AdminFunnelStep[];
  generatedAt: string;
}

export interface AdminRetentionCohort {
  /** Monday of the signup week, as a Nairobi date (YYYY-MM-DD). */
  weekStart: string;
  users: number;
  /**
   * Share of the cohort with an invoice made Ready in each week, starting with
   * the signup week and ending with the current week; null when the cohort is empty.
   */
  activeShare: (number | null)[];
}

export interface AdminRetention {
  weeks: AdminRetentionWeeks;
  /** Oldest cohort first. */
  cohorts: AdminRetentionCohort[];
  generatedAt: string;
}

export interface AdminPlan {
  code: "free" | "pro";
  /** When Pro access ends; null on Free. */
  proUntil: string | null;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  signInMethod: AdminSignInMethod;
  plan: AdminPlan;
  signedUpAt: string;
  businesses: number;
  invoicesReady: number;
  /** Latest session refresh; null when the user has no session. */
  lastActiveAt: string | null;
}

export interface AdminUsersPage {
  page: number;
  pageSize: number;
  total: number;
  users: AdminUserRow[];
  generatedAt: string;
}

export interface AdminUserBusiness {
  id: string;
  name: string;
  createdAt: string;
  clients: number;
  invoices: Record<InvoiceStatus, number>;
}

export interface AdminUserPayment {
  id: string;
  createdAt: string;
  confirmedAt: string | null;
  purpose: SubscriptionPurpose;
  amountKes: string;
  status: SubscriptionPaymentStatus;
  receipt: string | null;
}

export interface AdminUserDetail {
  user: AdminUserRow;
  businesses: AdminUserBusiness[];
  payments: AdminUserPayment[];
}

export interface AdminBillingPayment {
  id: string;
  createdAt: string;
  userId: string;
  userEmail: string;
  purpose: SubscriptionPurpose;
  amountKes: string;
  /** USD list price at checkout; null for payments made before prices were stored. */
  priceUsd: string | null;
  status: SubscriptionPaymentStatus;
  /** Middle digits hidden, like +2547•••••678. */
  phone: string;
  receipt: string | null;
  /** M-Pesa's reason, for failed payments only. */
  resultDescription: string | null;
}

export interface AdminFreeLimitHit {
  userId: string;
  userEmail: string;
  /** The Free month, as a Nairobi YYYY-MM. */
  month: string;
  limit: number;
  /** When the limit-th invoice of the month was made Ready. */
  hitAt: string;
  /** A succeeded plan payment between the hit and 30 days after the month ended. */
  paidWithin30Days: boolean;
}

export interface AdminBilling {
  /** The 50 most recent plan payments, newest first. */
  recentPayments: AdminBillingPayment[];
  /** Pending for more than 10 minutes, oldest first. */
  stuckPayments: AdminBillingPayment[];
  /**
   * Free months whose limit was reached in the last 90 days while still on
   * Free; months where the limit-th invoice went to a Pro period are left out.
   */
  freeLimitHits: AdminFreeLimitHit[];
  generatedAt: string;
}
