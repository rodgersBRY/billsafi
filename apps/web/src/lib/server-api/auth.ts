import "server-only";
import { redirect } from "next/navigation";
import { apiGet, EXPIRED_SESSION_PATH } from "./request";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  /** Platform role, synced from ADMIN_USER_IDS when the API starts (D061). */
  role?: string | null;
}

export async function getSessionUser(): Promise<SessionUser> {
  const session = await apiGet<{ user: SessionUser } | null>("/auth/get-session");
  // A null session means the cookie is stale; the proxy clears it on the way to sign-in.
  if (!session) redirect(EXPIRED_SESSION_PATH);

  return session.user;
}
