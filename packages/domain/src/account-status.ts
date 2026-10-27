import { addNairobiMonths, proPeriodAt } from "./billing-period.js";

/*
 * The three statuses the admin shows for every account (super admin spec 7.3). They are
 * kept apart on purpose: a suspended account can still be on Pro, and a Pro account can
 * be inactive. The admin API computes the same rules in SQL (apps/api/src/admin/account-sql.ts)
 * so it can filter and page on them; its e2e suite checks the two agree.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pro is "ending" when paid access stops within this many days. */
export const PRO_ENDING_WITHIN_DAYS = 7;

/** An activated account with no meaningful action for this many days is inactive. */
export const INACTIVE_AFTER_DAYS = 30;

/** Whether the account may sign in, from the admin plugin's `banned` flag. */
export const accountStatuses = ["active", "suspended"] as const;
export type AccountStatus = (typeof accountStatuses)[number];

/**
 * free: never had Pro (or only an empty row). pro: paid access now, ending in more than
 * 7 days. pro_ending: paid access now, ending within 7 days. lapsed: had Pro, it ended
 * and was not renewed.
 */
export const subscriptionStatuses = ["free", "pro", "pro_ending", "lapsed"] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

/**
 * Where the account is in its journey. When more than one applies, the first match in
 * this order wins: subscribed > inactive > activated > onboarding > registered.
 * - subscribed: Pro access now (pro or pro_ending)
 * - inactive: has made an invoice Ready, but no meaningful action in the last 30 days
 * - activated: has made an invoice Ready
 * - onboarding: has a business, no Ready invoice yet
 * - registered: no business yet
 */
export const lifecycleStages = [
  "registered",
  "onboarding",
  "activated",
  "subscribed",
  "inactive",
] as const;
export type LifecycleStage = (typeof lifecycleStages)[number];

/**
 * The account actions that count as using Billsafi: an invoice created, an invoice made
 * Ready, a payment recorded, a client added. Signing in alone does not count.
 */
export const meaningfulActions = [
  "invoice_created",
  "invoice_ready",
  "payment_recorded",
  "client_added",
] as const;
export type MeaningfulAction = (typeof meaningfulActions)[number];

export function accountStatus(banned: boolean): AccountStatus {
  return banned ? "suspended" : "active";
}

/** The account's Pro entitlement as stored on its subscriptions row. */
export interface ProEntitlement {
  anchorAt: Date | null;
  paidMonths: number;
}

/** When the current or most recent run of paid months ends; null if Pro was never paid. */
export function proEndsAt({ anchorAt, paidMonths }: ProEntitlement): Date | null {
  return anchorAt && paidMonths > 0 ? addNairobiMonths(anchorAt, paidMonths) : null;
}

/** Pro access right now, by the one Pro rule the app uses (proPeriodAt). */
export function hasProAccess({ anchorAt, paidMonths }: ProEntitlement, now: Date): boolean {
  return Boolean(anchorAt && proPeriodAt(anchorAt, paidMonths, now));
}

export function subscriptionStatus(entitlement: ProEntitlement, now: Date): SubscriptionStatus {
  const endsAt = proEndsAt(entitlement);
  if (hasProAccess(entitlement, now)) {
    return endsAt!.getTime() - now.getTime() <= PRO_ENDING_WITHIN_DAYS * DAY_MS
      ? "pro_ending"
      : "pro";
  }
  return endsAt && endsAt <= now ? "lapsed" : "free";
}

export interface LifecycleFacts {
  businesses: number;
  readyInvoices: number;
  proAccess: boolean;
  lastMeaningfulActivityAt: Date | null;
}

export function lifecycleStage(facts: LifecycleFacts, now: Date): LifecycleStage {
  if (facts.proAccess) return "subscribed";
  if (facts.readyInvoices > 0) {
    const last = facts.lastMeaningfulActivityAt;
    const cutoff = now.getTime() - INACTIVE_AFTER_DAYS * DAY_MS;
    return !last || last.getTime() < cutoff ? "inactive" : "activated";
  }
  return facts.businesses > 0 ? "onboarding" : "registered";
}
