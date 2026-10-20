import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApiError, parseApiResponse } from "../api-error";

export const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

/**
 * Server-side GET to the API with the visitor's cookies. Reads runtime data,
 * so callers must render inside <Suspense>. 401 redirects to sign-in, 404
 * renders the not-found page.
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

/** Builds a query string from the set values only. */
export function query(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, value]) => value) as [string, string][];
  return entries.length ? `?${new URLSearchParams(entries)}` : "";
}

export const businessPath = (businessId: string) => `/businesses/${encodeURIComponent(businessId)}`;

export const invoicePath = (businessId: string, invoiceId: string) =>
  `${businessPath(businessId)}/invoices/${encodeURIComponent(invoiceId)}`;
