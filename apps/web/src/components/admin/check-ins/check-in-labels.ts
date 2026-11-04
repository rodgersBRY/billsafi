import type { ReengagementSegment, ReengagementStep } from "@billsafi/contracts";

/** Who each sequence is for, in admin wording (D069). */
export const segmentLabels: Record<ReengagementSegment, string> = {
  no_business: "No business yet",
  no_invoice: "No invoice yet",
  lapsed: "Went quiet",
};

/** Emails 1 and 2 are branded; 3 is the plain note that asks for a reply. */
export function stepLabel(step: ReengagementStep): string {
  return step === 3 ? "Email 3 (note)" : `Email ${step}`;
}
