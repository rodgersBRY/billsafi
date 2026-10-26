import { z } from "zod";
import { blankToUndefined } from "./query-params.js";

/*
 * Super admin phase 4: Overview and Analytics (D063). Every figure uses one date range.
 * Money is a 2dp string and never mixes KES with USD, shares and rates are fractions from
 * 0 to 1 (null when the base is 0), instants are ISO strings, and bucket starts are
 * Nairobi dates (YYYY-MM-DD).
 */

export const adminRanges = ["7d", "30d", "90d", "12m"] as const;
export type AdminRange = (typeof adminRanges)[number];
export const DEFAULT_ADMIN_RANGE: AdminRange = "30d";

/** `?range=` on every Overview and Analytics route. Blank means the default. */
export const adminRangeQuerySchema = z.object({
  range: z.preprocess(blankToUndefined, z.enum(adminRanges).default(DEFAULT_ADMIN_RANGE)),
});
export type AdminRangeQuery = z.output<typeof adminRangeQuerySchema>;

export const ADMIN_ACTIVITY_DEFAULT_LIMIT = 20;
export const ADMIN_ACTIVITY_MAX_LIMIT = 50;

export const adminActivityQuerySchema = z.object({
  limit: z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int()
      .min(1)
      .max(ADMIN_ACTIVITY_MAX_LIMIT)
      .default(ADMIN_ACTIVITY_DEFAULT_LIMIT),
  ),
});
export type AdminActivityQuery = z.output<typeof adminActivityQuerySchema>;

/** How a range is cut into chart buckets: days for 7d and 30d, weeks for 90d, months for 12m. */
export const adminBucketSizes = ["day", "week", "month"] as const;
export type AdminBucketSize = (typeof adminBucketSizes)[number];

const instant = z.string();
const moneyString = z.string().regex(/^\d+\.\d{2}$/);
const share = z.number().min(0).max(1).nullable();
const count = z.number().int().min(0);

/** Nairobi-day cut-offs: start inclusive, end exclusive (the request time for the current period). */
export const adminPeriodSchema = z.object({ start: instant, end: instant });
export type AdminPeriod = z.infer<typeof adminPeriodSchema>;

const pair = <T extends z.ZodType>(value: T) => z.object({ current: value, previous: value });

/** A rate with the counts behind it, so a small base never looks bigger than it is. */
export const adminRateSchema = z.object({ rate: share, count, base: count });
export type AdminRate = z.infer<typeof adminRateSchema>;

export const adminSignupSplitSchema = z.object({ total: count, google: count, email: count });
export type AdminSignupSplit = z.infer<typeof adminSignupSplitSchema>;

/**
 * What needs the owner today. Each count equals the total of a directory query (the web adds
 * the links): stuckPayments is GET /admin/subscription-payments?stuck=true, suspendedAccounts
 * GET /admin/tenants?accountStatus=suspended, proEnding GET /admin/subscriptions?renewalWithin=7,
 * proLapsed GET /admin/subscriptions?lapsedWithin=30, overridesEnding
 * GET /admin/overrides?endingWithin=7. freeLimitReached counts the Free months of this
 * Nairobi month in GET /admin/billing's freeLimitHits.
 */
export const adminAttentionSchema = z.object({
  stuckPayments: count,
  suspendedAccounts: count,
  proEnding: count,
  proLapsed: count,
  freeLimitReached: count,
  overridesEnding: count,
});
export type AdminAttention = z.infer<typeof adminAttentionSchema>;

export const adminOverviewSchema = z.object({
  range: z.enum(adminRanges),
  /** The chosen range, ending now. */
  period: adminPeriodSchema,
  /** The range of the same length just before it, which every `previous` value covers. */
  previousPeriod: adminPeriodSchema,
  /** All time: now, and at the start of the range. */
  totalAccounts: pair(count),
  /** Sign-ups in the range, split by whether the account has a Google login. */
  signups: pair(adminSignupSplitSchema),
  /** Accounts with a meaningful action in the range. */
  activeAccounts: pair(count),
  /** Pro accounts whose Pro month was paid for, now and at the start of the range. */
  payingAccounts: pair(count),
  /** Pro accounts whose Pro month was a gift; never revenue. */
  complimentaryProAccounts: pair(count),
  /** Paying accounts times the Pro price in USD. */
  mrrUsd: pair(moneyString),
  /** count = accounts that lost Pro in the range, base = accounts with Pro at its start. */
  proChurn: pair(adminRateSchema),
  invoicesReady: pair(count),
  /** Succeeded plan payments by the day paid, KES and USD apart. */
  collected: z.object({ kes: pair(moneyString), usd: pair(moneyString) }),
  /** M-Pesa plan checkouts settled in the range, by checkout time; pending ones are left out. */
  mpesa: pair(z.object({ succeeded: count, failed: count, successRate: share })),
  /** count = sign-ups with a Ready invoice within 7 days, base = sign-ups at least 7 days old. */
  activation: pair(adminRateSchema),
  attention: adminAttentionSchema,
  /** One plain sentence per figure: what it counts and where its cut-offs fall. */
  definitions: z.object({
    totalAccounts: z.string(),
    signups: z.string(),
    activeAccounts: z.string(),
    payingAccounts: z.string(),
    complimentaryProAccounts: z.string(),
    mrrUsd: z.string(),
    proChurn: z.string(),
    invoicesReady: z.string(),
    collected: z.string(),
    mpesa: z.string(),
    activation: z.string(),
  }),
  generatedAt: instant,
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

export const adminTrendPointSchema = z.object({
  /** Nairobi date the bucket starts on. The first bucket of a range starts at the range start. */
  bucketStart: z.string(),
  signups: count,
  /** Every account that existed at the end of the bucket (or now, for the last one). */
  accountsTotal: count,
  /** Accounts that made their first invoice Ready in the bucket. */
  firstInvoices: count,
  invoicesReady: count,
  kesCollected: moneyString,
  usdCollected: moneyString,
});
export type AdminTrendPoint = z.infer<typeof adminTrendPointSchema>;

/**
 * A snapshot of every account now, split so the parts add up to `total`. Pro ending is Pro
 * of either kind that ends within 7 days, so it is not repeated in paid or complimentary.
 * Lapsed is Pro that ended in the last 30 days; Free is everyone else off Pro.
 */
export const adminSubscriptionMixSchema = z.object({
  total: count,
  free: count,
  proPaid: count,
  proComplimentary: count,
  proEnding: count,
  lapsed: count,
});
export type AdminSubscriptionMix = z.infer<typeof adminSubscriptionMixSchema>;

export const adminTrendsSchema = z.object({
  range: z.enum(adminRanges),
  bucketSize: z.enum(adminBucketSizes),
  period: adminPeriodSchema,
  /** Oldest first, one per bucket with empty buckets as zero. */
  points: z.array(adminTrendPointSchema),
  subscriptionMix: adminSubscriptionMixSchema,
  generatedAt: instant,
});
export type AdminTrends = z.infer<typeof adminTrendsSchema>;

export const adminActivityKinds = [
  "signed_up",
  "first_invoice_ready",
  "pro_payment",
  "credit_pack",
  "mpesa_failed",
  "grant_given",
  "override_added",
  "pro_ended",
  "account_suspended",
  "account_reactivated",
  "sessions_revoked",
] as const;
export type AdminActivityKind = (typeof adminActivityKinds)[number];

export const adminActivityItemSchema = z.object({
  /** Stable per event, such as "pro_payment:<payment id>". */
  id: z.string(),
  kind: z.enum(adminActivityKinds),
  at: instant,
  account: z.object({ id: z.string(), name: z.string() }).nullable(),
  summary: z.string(),
  /** The admin who acted, for admin actions only. */
  admin: z.object({ id: z.string(), name: z.string() }).nullable(),
});
export type AdminActivityItem = z.infer<typeof adminActivityItemSchema>;

export const adminActivitySchema = z.object({
  /** Newest first. */
  items: z.array(adminActivityItemSchema),
  generatedAt: instant,
});
export type AdminActivity = z.infer<typeof adminActivitySchema>;

export const adminInvoiceVolumePointSchema = z.object({
  bucketStart: z.string(),
  created: count,
  ready: count,
});

export const adminFeatureKeys = [
  "discount",
  "tax",
  "logo",
  "paymentInstructions",
  "shareLink",
  "paymentRecorded",
  "secondBusiness",
  "googleSignIn",
] as const;
export type AdminFeatureKey = (typeof adminFeatureKeys)[number];

export const adminFeatureAdoptionItemSchema = z.object({
  key: z.enum(adminFeatureKeys),
  count,
  base: count,
  share,
});

export const adminPlanLimitMonthSchema = z.object({
  /** The Free month, as a Nairobi YYYY-MM. */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  /** Free accounts that used their whole allowance (override extras included) that month. */
  reached: count,
  /** Of those, accounts with a succeeded Pro or credit payment within 14 days of the hit. */
  boughtWithin14Days: count,
});

export const adminTopAccountSchema = z.object({
  /** The tenant id, so the web links to the tenant page. */
  accountId: z.string(),
  name: z.string(),
  email: z.string(),
  readyInvoices: count,
});

export const adminAnalyticsSchema = z.object({
  range: z.enum(adminRanges),
  bucketSize: z.enum(adminBucketSizes),
  period: adminPeriodSchema,
  invoiceVolume: z.object({
    points: z.array(adminInvoiceVolumePointSchema),
    /** Accounts that made at least one invoice Ready in the range. */
    accountsWithReady: count,
    /** Median Ready invoices among those accounts; null when there are none. */
    medianReadyPerAccount: z.number().nullable(),
  }),
  timeToFirstInvoice: z.object({
    /** Sign-ups in the range. */
    signups: count,
    /** Of them, accounts that have made an invoice Ready so far. */
    reached: count,
    /** Hours from sign-up to the first Ready invoice, among those who reached it. */
    medianHours: z.number().nullable(),
    p75Hours: z.number().nullable(),
    activation: adminRateSchema,
  }),
  featureAdoption: z.object({
    /** Accounts with at least one business; the base of every item. */
    base: count,
    items: z.array(adminFeatureAdoptionItemSchema),
  }),
  /** The last 6 Nairobi months, oldest first, whatever the range. */
  planLimit: z.array(adminPlanLimitMonthSchema),
  /** Up to 10, most Ready invoices in the range first. */
  topAccounts: z.array(adminTopAccountSchema),
  definitions: z.object({
    invoiceVolume: z.string(),
    timeToFirstInvoice: z.string(),
    featureAdoption: z.string(),
    planLimit: z.string(),
    topAccounts: z.string(),
  }),
  generatedAt: instant,
});
export type AdminAnalytics = z.infer<typeof adminAnalyticsSchema>;
