import "server-only";
import type { GettingStarted, ProductTourState } from "@billsafi/contracts";
import { apiGet } from "./request";

/** Tours the account has finished or skipped (D057). */
export function getProductTours(): Promise<ProductTourState[]> {
  return apiGet<ProductTourState[]>("/me/tours");
}

/** Account-wide first steps for the Overview checklist (D057). */
export function getGettingStarted(): Promise<GettingStarted> {
  return apiGet<GettingStarted>("/me/getting-started");
}
