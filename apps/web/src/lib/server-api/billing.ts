import "server-only";
import type { AllowanceUsage, BillingOverview } from "@billsafi/contracts";
import { apiGet } from "./request";

/** Account-wide allowance for the sidebar meter and the invoice editor. */
export function getUsage(): Promise<AllowanceUsage> {
  return apiGet<AllowanceUsage>("/usage");
}

export function getBilling(): Promise<BillingOverview> {
  return apiGet<BillingOverview>("/billing");
}
