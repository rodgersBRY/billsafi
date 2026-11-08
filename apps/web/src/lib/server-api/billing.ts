import "server-only";
import type { AllowanceUsage, BillingOverview } from "@billsafi/contracts";
import { cache } from "react";
import { apiGet } from "./request";

/** Account-wide allowance for the sidebar meter and the invoice editor. One fetch per request. */
export const getUsage = cache((): Promise<AllowanceUsage> => apiGet<AllowanceUsage>("/usage"));

export function getBilling(): Promise<BillingOverview> {
  return apiGet<BillingOverview>("/billing");
}
