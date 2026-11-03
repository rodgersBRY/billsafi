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
