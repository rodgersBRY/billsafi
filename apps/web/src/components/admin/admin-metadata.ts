import "server-only";
import type { Metadata } from "next";
import { getAdminAccess } from "@/lib/server-api/admin";

/**
 * Page metadata for admin pages. The access check runs first, so a non-admin's
 * not-found page keeps the app's usual title instead of one that names the admin.
 */
export async function adminMetadata(title: string): Promise<Metadata> {
  await getAdminAccess();
  return { title: `${title} · Admin · BillSafi`, robots: { index: false, follow: false } };
}
