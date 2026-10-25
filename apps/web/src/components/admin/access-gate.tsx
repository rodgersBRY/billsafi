import "server-only";
import { getAdminAccess } from "@/lib/server-api/admin";

/** Renders its children only once the API confirms admin access; anyone else gets 404. */
export async function AccessGate({ children }: { children: React.ReactNode }) {
  await getAdminAccess();
  return <>{children}</>;
}
