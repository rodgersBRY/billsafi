import "server-only";
import type { RecurringInvoice, RecurringInvoiceSummary } from "@billsafi/contracts";
import { apiGet, businessPath } from "./request";

export function listRecurring(businessId: string): Promise<RecurringInvoiceSummary[]> {
  return apiGet<RecurringInvoiceSummary[]>(`${businessPath(businessId)}/recurring-invoices`);
}

export function getRecurring(businessId: string, recurringId: string): Promise<RecurringInvoice> {
  return apiGet<RecurringInvoice>(
    `${businessPath(businessId)}/recurring-invoices/${encodeURIComponent(recurringId)}`,
  );
}
