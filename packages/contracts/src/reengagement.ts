import { z } from "zod";

/**
 * Where a quiet account stopped (D069). Each group gets its own short sequence of
 * check-in emails.
 */
export const reengagementSegments = ["no_business", "no_invoice", "lapsed"] as const;
export type ReengagementSegment = (typeof reengagementSegments)[number];

/** Each sequence has at most three emails. */
export const reengagementSteps = [1, 2, 3] as const;
export type ReengagementStep = (typeof reengagementSteps)[number];

/** Signed token from the unsubscribe link in a check-in email. */
export const unsubscribeRequestSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, "The unsubscribe link is incomplete")
    .max(200, "The unsubscribe link is not valid"),
});
export type UnsubscribeRequest = z.infer<typeof unsubscribeRequestSchema>;

/** Figures for one email in the sequence, such as "no business yet, email 2". */
export interface AdminCheckInStep {
  segment: ReengagementSegment;
  step: ReengagementStep;
  sent: number;
  /** Emails followed by a sign-in or action within the return window. */
  returned: number;
  /** returned / sent; null when none were sent. */
  returnRate: number | null;
}

/** The check-in emails panel on admin Analytics (D069). */
export interface AdminCheckIns {
  /** REENGAGEMENT_JOBS in this environment. */
  enabled: boolean;
  dailyLimit: number;
  period: { start: string; end: string };
  /** Days after an email in which a sign-in or action counts as a return. */
  returnWindowDays: number;
  totals: {
    sent: number;
    /** Distinct accounts emailed in the range. */
    accounts: number;
    returned: number;
    returnRate: number | null;
    /** Sent less than the return window ago and not back yet, so they may still return. */
    stillOpen: number;
    /** Accounts that unsubscribed in the range. */
    unsubscribed: number;
  };
  /** Every segment and step, in sequence order, including those with nothing sent. */
  steps: AdminCheckInStep[];
  generatedAt: string;
}

/** Check-in emails for one account, on the admin tenant page. */
export interface AdminTenantCheckIns {
  /** When the account unsubscribed from check-in emails; null if it hasn't. */
  optedOutAt: string | null;
  /** Newest first. */
  emails: { segment: ReengagementSegment; step: ReengagementStep; sentAt: string }[];
}
