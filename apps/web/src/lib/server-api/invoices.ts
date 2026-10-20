import "server-only";
import type {
  Dashboard,
  Invoice,
  InvoiceLinkStatus,
  InvoiceStatus,
  InvoiceSummary,
  Payment,
} from "@billsafi/contracts";
import { apiGet, businessPath, invoicePath, query } from "./request";

export function listInvoices(
  businessId: string,
  filter: { status?: InvoiceStatus | "overdue"; search?: string } = {},
): Promise<InvoiceSummary[]> {
  return apiGet<InvoiceSummary[]>(`${businessPath(businessId)}/invoices${query(filter)}`);
}

export function getInvoice(businessId: string, invoiceId: string): Promise<Invoice> {
  return apiGet<Invoice>(invoicePath(businessId, invoiceId));
}

export function listPayments(businessId: string, invoiceId: string): Promise<Payment[]> {
  return apiGet<Payment[]>(`${invoicePath(businessId, invoiceId)}/payments`);
}

export async function getInvoiceLink(
  businessId: string,
  invoiceId: string,
): Promise<InvoiceLinkStatus | null> {
  return (
    await apiGet<{ link: InvoiceLinkStatus | null }>(`${invoicePath(businessId, invoiceId)}/link`)
  ).link;
}

export function getDashboard(businessId: string): Promise<Dashboard> {
  return apiGet<Dashboard>(`${businessPath(businessId)}/dashboard`);
}
