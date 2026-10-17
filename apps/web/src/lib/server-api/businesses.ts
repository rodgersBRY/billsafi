import "server-only";
import type { Business, PaymentInstruction } from "@tallynest/contracts";
import { apiGet, businessPath } from "./request";

export function listBusinesses(): Promise<Business[]> {
  return apiGet<Business[]>("/businesses");
}

export function getBusiness(businessId: string): Promise<Business> {
  return apiGet<Business>(businessPath(businessId));
}

export function listPaymentInstructions(businessId: string): Promise<PaymentInstruction[]> {
  return apiGet<PaymentInstruction[]>(`${businessPath(businessId)}/payment-instructions`);
}
