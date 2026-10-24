import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { apiInternalUrl } from "../api-url";
import { ApiError, parseApiResponse } from "../api-error";

/** Sign-in URL that tells the proxy the session cookie is no longer valid. */
export const EXPIRED_SESSION_PATH = "/sign-in?session=expired";

export { apiInternalUrl };

/**
 * Server-side GET to the API with the visitor's cookies. Reads runtime data,
 * so callers must render inside <Suspense>. 401 sends the visitor to sign-in
 * through the proxy, which clears the dead session cookie first. 404
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
    if (error instanceof ApiError && error.status === 401) redirect(EXPIRED_SESSION_PATH);

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
