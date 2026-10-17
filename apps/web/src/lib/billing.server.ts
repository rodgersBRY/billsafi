import "server-only";
import type { BillingOverview } from "@tallynest/contracts";
import { apiGet } from "./api.server";

export function getBilling(): Promise<BillingOverview> {
  return apiGet<BillingOverview>("/billing");
}
