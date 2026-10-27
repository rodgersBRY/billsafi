import type {
  AdminAccountStatus,
  AdminLifecycleStage,
  AdminSubscriptionStatus,
} from "@billsafi/contracts";

/* What each status means, from the rules in @billsafi/domain (account-status.ts). */

export const accountStatusHelp: Record<AdminAccountStatus, string> = {
  active: "The owner can sign in.",
  suspended: "The owner can't sign in. Invoice links already sent keep working.",
};

export const subscriptionStatusHelp: Record<AdminSubscriptionStatus, string> = {
  free: "Has never had paid Pro access.",
  pro: "Paid Pro access, with more than 7 days left.",
  pro_ending: "Paid Pro access that ends within 7 days.",
  lapsed: "Had Pro, but it ended and was not renewed.",
};

export const lifecycleHelp: Record<AdminLifecycleStage, string> = {
  registered: "Signed up, but has no business yet.",
  onboarding: "Has a business, but no invoice made Ready yet.",
  activated: "Has made an invoice Ready and was active in the last 30 days.",
  subscribed: "Has Pro access now.",
  inactive: "Has made an invoice Ready, but nothing meaningful in the last 30 days.",
};
