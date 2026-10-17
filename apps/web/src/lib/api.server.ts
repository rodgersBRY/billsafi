import "server-only";
import type {
  AllowanceUsage,
  Business,
  Client,
  Invoice,
  InvoiceStatus,
  InvoiceSummary,
  PaymentInstruction,
} from "@tallynest/contracts";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApiError, parseApiResponse } from "./api-error";

const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

/**
 * Server-side call to the API with the visitor's cookies. Reads runtime data,
 * so callers must render inside <Suspense>. A missing session redirects to sign-in.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${apiInternalUrl}/api/v1${path}`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  try {
    return await parseApiResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/sign-in");
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export async function getSessionUser(): Promise<SessionUser> {
  const session = await apiGet<{ user: SessionUser } | null>("/auth/get-session");
  if (!session) redirect("/sign-in");
  return session.user;
}

export function listBusinesses(): Promise<Business[]> {
  return apiGet<Business[]>("/businesses");
}

export function getBusiness(businessId: string): Promise<Business> {
  return apiGet<Business>(`/businesses/${encodeURIComponent(businessId)}`);
}

function query(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, value]) => value) as [string, string][];
  return entries.length ? `?${new URLSearchParams(entries)}` : "";
}

const businessPath = (businessId: string) => `/businesses/${encodeURIComponent(businessId)}`;

export function listClients(
  businessId: string,
  filter: { status?: "active" | "archived"; search?: string } = {},
): Promise<Client[]> {
  return apiGet<Client[]>(`${businessPath(businessId)}/clients${query(filter)}`);
}

export function listInvoices(
  businessId: string,
  filter: { status?: InvoiceStatus; search?: string } = {},
): Promise<InvoiceSummary[]> {
  return apiGet<InvoiceSummary[]>(`${businessPath(businessId)}/invoices${query(filter)}`);
}

export function getInvoice(businessId: string, invoiceId: string): Promise<Invoice> {
  return apiGet<Invoice>(`${businessPath(businessId)}/invoices/${encodeURIComponent(invoiceId)}`);
}

export function listPaymentInstructions(businessId: string): Promise<PaymentInstruction[]> {
  return apiGet<PaymentInstruction[]>(`${businessPath(businessId)}/payment-instructions`);
}

export function getUsage(): Promise<AllowanceUsage> {
  return apiGet<AllowanceUsage>("/usage");
}
