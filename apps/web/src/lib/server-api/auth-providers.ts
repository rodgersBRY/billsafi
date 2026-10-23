import "server-only";
import { apiInternalUrl } from "./request";

export interface AuthProviders {
  google: boolean;
}

/**
 * Which extra sign-in buttons to show (D055). Reads runtime data, so callers
 * render inside <Suspense>. If the API cannot answer, the buttons stay hidden
 * and email sign-in still works.
 */
export async function getAuthProviders(): Promise<AuthProviders> {
  try {
    const response = await fetch(`${apiInternalUrl}/api/v1/auth-providers`, {
      cache: "no-store",
    });
    if (!response.ok) return { google: false };
    const body = (await response.json()) as Partial<AuthProviders>;
    return { google: body.google === true };
  } catch {
    return { google: false };
  }
}
