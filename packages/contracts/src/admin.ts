import {
  type AccountStatus,
  accountStatuses,
  type LifecycleStage,
  lifecycleStages,
  type SubscriptionStatus,
  subscriptionStatuses,
} from "@billsafi/domain";
import { z } from "zod";
import type { AdminPlanPayment } from "./admin-subscriptions.js";
import {
  blankToUndefined,
  optionalDate,
  optionalDays,
  optionalEnum,
  optionalText,
  pageParam,
  searchParam,
  sortDirParam,
} from "./query-params.js";
import type { InvoiceStatus } from "./invoices.js";

/*
 * Read-only admin dashboard (spec 2026-10-24). Shares and rates are fractions
 * from 0 to 1, money is a 2dp string, dates are ISO instants unless noted.
 */

export const adminFunnelDays = [7, 30, 90] as const;
export type AdminFunnelDays = (typeof adminFunnelDays)[number];

export const adminRetentionWeeks = [4, 8, 12] as const;
export type AdminRetentionWeeks = (typeof adminRetentionWeeks)[number];

export const ADMIN_TENANTS_PAGE_SIZE = 25;
export const ADMIN_USERS_PAGE_SIZE = 25;
export const ADMIN_AUDIT_PAGE_SIZE = 50;

/** Why an admin is acting; required on every admin action and kept in the audit log. */
export const reasonSchema = z
  .string({ error: "Give a reason" })
  .trim()
  .min(5, "Give a reason of at least 5 characters")
  .max(500, "Keep the reason under 500 characters");

/** Request body shared by admin actions that need nothing but a reason. */
export const adminActionBodySchema = z.object({ reason: reasonSchema });
export type AdminActionBody = z.output<typeof adminActionBodySchema>;

/**
 * An action normally answers with the fresh tenant or user row. If the change committed
 * but reading that row back failed, it answers this instead; reload to see the result.
 */
export interface AdminActionAck {
  ok: true;
}

export const adminFunnelQuerySchema = z.object({
  days: z.coerce.number().pipe(z.literal(adminFunnelDays)).default(30),
});
export type AdminFunnelQuery = z.output<typeof adminFunnelQuerySchema>;

export const adminRetentionQuerySchema = z.object({
  weeks: z.coerce.number().pipe(z.literal(adminRetentionWeeks)).default(8),
});
export type AdminRetentionQuery = z.output<typeof adminRetentionQuerySchema>;

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

/** A plan payment in the admin Billing tab; see AdminPlanPayment. */
export type AdminBillingPayment = AdminPlanPayment;

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

/*
 * Tenants, users and the audit log (super admin phases 1 and 2). A tenant is an account:
 * one user and the businesses they own, so a tenant id is the owner's user id.
 * Status definitions live in @billsafi/domain (account-status.ts) and are re-exported here.
 */

export const adminAccountStatuses = accountStatuses;
export type AdminAccountStatus = AccountStatus;
export const adminSubscriptionStatuses = subscriptionStatuses;
/** Not billing's SubscriptionStatus: this one adds pro_ending and lapsed for the admin. */
export type AdminSubscriptionStatus = SubscriptionStatus;
export const adminLifecycleStages = lifecycleStages;
export type AdminLifecycleStage = LifecycleStage;

export const adminSortDirections = ["asc", "desc"] as const;
export type AdminSortDirection = (typeof adminSortDirections)[number];

export const adminWindowDays = [7, 30, 90] as const;
export type AdminWindowDays = (typeof adminWindowDays)[number];

export const adminTenantSorts = ["registered", "lastActivity", "readyInvoices", "name"] as const;
export type AdminTenantSort = (typeof adminTenantSorts)[number];

export const adminTenantsQuerySchema = z
  .object({
    page: pageParam,
    /** Owner name or email, any business display name, or an exact account id. */
    search: searchParam,
    accountStatus: optionalEnum(accountStatuses),
    subscriptionStatus: optionalEnum(subscriptionStatuses),
    lifecycle: optionalEnum(lifecycleStages),
    /** Registered within the last N days. */
    signedUp: optionalDays(adminWindowDays),
    /** A meaningful action within the last N days. */
    activeWithin: optionalDays(adminWindowDays),
    /** No meaningful action for N days, never-active accounts included. */
    inactiveFor: optionalDays([30]),
    sort: z.preprocess(blankToUndefined, z.enum(adminTenantSorts).default("registered")),
    dir: sortDirParam,
  })
  .refine((query) => !(query.activeWithin && query.inactiveFor), {
    message: "Filter by activeWithin or inactiveFor, not both",
    path: ["inactiveFor"],
  });
export type AdminTenantsQuery = z.output<typeof adminTenantsQuerySchema>;

export const adminRoles = ["user", "admin"] as const;
export type AdminRole = (typeof adminRoles)[number];

/** "email" is a password login, "google" a Google login; an account can have both. */
export const adminSignInMethods = ["email", "google"] as const;
export type AdminSignInMethod = (typeof adminSignInMethods)[number];

export const adminUserSorts = ["registered", "lastLogin"] as const;
export type AdminUserSort = (typeof adminUserSorts)[number];

export const adminUsersQuerySchema = z.object({
  page: pageParam,
  /** Name or email, or an exact user id. */
  search: searchParam,
  role: optionalEnum(adminRoles),
  accountStatus: optionalEnum(accountStatuses),
  signInMethod: optionalEnum(adminSignInMethods),
  sort: z.preprocess(blankToUndefined, z.enum(adminUserSorts).default("registered")),
  dir: sortDirParam,
});
export type AdminUsersQuery = z.output<typeof adminUsersQuerySchema>;

export const adminAuditOutcomes = ["success", "failure"] as const;
export type AdminAuditOutcome = (typeof adminAuditOutcomes)[number];

export const adminAuditLogsQuerySchema = z
  .object({
    page: pageParam,
    /** Exact action, such as tenant.suspend. */
    action: optionalText(100),
    targetType: optionalText(50),
    targetId: optionalText(100),
    actorId: z.preprocess(blankToUndefined, z.uuid().optional()),
    outcome: optionalEnum(adminAuditOutcomes),
    /** From the start of this Nairobi day. */
    from: optionalDate,
    /** Up to the end of this Nairobi day. */
    to: optionalDate,
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "The start date must not be after the end date",
    path: ["to"],
  });
export type AdminAuditLogsQuery = z.output<typeof adminAuditLogsQuerySchema>;

export interface AdminPlan {
  code: "free" | "pro";
  label: "Free" | "Pro";
  /** When Pro access ends; null on Free. */
  proUntil: string | null;
}

export interface AdminAuditRow {
  id: string;
  occurredAt: string;
  actor: {
    /** Null for the system, such as the start-up admin role sync. */
    userId: string | null;
    role: string;
    /** The actor's current email, when the user still exists. */
    email: string | null;
  };
  action: string;
  target: { type: string; id: string };
  outcome: AdminAuditOutcome;
  reason: string | null;
  /** Redacted before and after values. */
  changes: unknown;
  requestId: string | null;
  ipAddress: string | null;
}

export interface AdminAuditPage {
  page: number;
  pageSize: number;
  total: number;
  /** Newest first. */
  entries: AdminAuditRow[];
  generatedAt: string;
}

export interface AdminTenantRow {
  /** The account id, which is the owner's user id. */
  id: string;
  owner: { name: string; email: string };
  /** The owner's platform role; admins can't be suspended. */
  role: AdminRole;
  /** The first business by creation date, and how many the account has. */
  businesses: { firstName: string | null; count: number };
  plan: AdminPlan;
  accountStatus: AdminAccountStatus;
  subscriptionStatus: AdminSubscriptionStatus;
  lifecycleStage: AdminLifecycleStage;
  registeredAt: string;
  /** Latest invoice created, invoice made Ready, payment recorded or client added. */
  lastMeaningfulActivityAt: string | null;
  readyInvoices: number;
}

export interface AdminTenantsPage {
  page: number;
  pageSize: number;
  total: number;
  tenants: AdminTenantRow[];
  generatedAt: string;
}

export interface AdminTenantBusiness {
  id: string;
  displayName: string;
  profileType: "individual" | "business";
  createdAt: string;
  contactEmail: string;
  /** Middle digits hidden, like +2547•••••678. */
  phone: string;
  clients: number;
  /** Every status, zero when the business has none. */
  invoices: Record<InvoiceStatus, number>;
  hasLogo: boolean;
  /** Size of the current logo; null without one. */
  logoBytes: number | null;
}

export interface AdminTenantUsage {
  /** The allowance window in force now: the Free month or the current Pro period. */
  allowance: {
    plan: "free" | "pro";
    used: number;
    limit: number;
    periodStart: string;
    periodEnd: string;
  };
  /** Purchased invoice credits not used yet. */
  credits: number;
  invoicesCreated: number;
  invoicesReady: number;
  clients: number;
  shareLinks: number;
  /** Recorded payments that have not been reversed. */
  paymentsRecorded: number;
  /** Every stored logo upload, old ones included (they are kept for issued invoices). */
  storageBytes: number;
}

/** A plan payment in tenant detail; see AdminPlanPayment. */
export type AdminTenantPayment = AdminPlanPayment;

export interface AdminTenantSubscription {
  plan: AdminPlan;
  status: AdminSubscriptionStatus;
  /** Start of the latest run of paid months. */
  anchorAt: string | null;
  paidMonths: number;
  /** End of the latest run of paid months, also when it has already lapsed. */
  paidUntil: string | null;
  /** Set while the account has asked not to continue after paid access. */
  cancelledAt: string | null;
  /** Every plan payment, M-Pesa and manual, newest first. */
  payments: AdminTenantPayment[];
}

export interface AdminTenantDetail {
  tenant: AdminTenantRow;
  identity: {
    emailVerified: boolean;
    role: AdminRole;
    signInMethods: AdminSignInMethod[];
    /** The reason given when the account was suspended; null while active. */
    suspendedReason: string | null;
  };
  businesses: AdminTenantBusiness[];
  usage: AdminTenantUsage;
  subscription: AdminTenantSubscription;
  /** The 20 most recent audit rows about this account or its user, newest first. */
  recentAudit: AdminAuditRow[];
  generatedAt: string;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: AdminRole;
  accountStatus: AdminAccountStatus;
  signInMethods: AdminSignInMethod[];
  registeredAt: string;
  /** Latest session sign-in or refresh; null when the user has no session. */
  lastLoginAt: string | null;
  /** The same id: every user is the owner of exactly one tenant (account). */
  tenantId: string;
}

export interface AdminUsersPage {
  page: number;
  pageSize: number;
  total: number;
  users: AdminUserRow[];
  generatedAt: string;
}

export interface AdminUserSession {
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  /** Summarised from the user agent; "Unknown" when it cannot be read. */
  device: { browser: string; os: string };
  /** Truncated to keep personal data down: the /24 for IPv4, the first 3 groups for IPv6. */
  ipAddress: string | null;
}

export interface AdminUserDetail {
  user: AdminUserRow;
  /** The 10 most recently used sessions. */
  sessions: AdminUserSession[];
  /** The 20 most recent audit rows about this user or their account, newest first. */
  recentAudit: AdminAuditRow[];
  generatedAt: string;
}
