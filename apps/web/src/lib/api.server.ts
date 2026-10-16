import "server-only";
import type { Business } from "@tallynest/contracts";
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
