import "server-only";
import { redirect } from "next/navigation";
import { apiGet } from "./request";

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
