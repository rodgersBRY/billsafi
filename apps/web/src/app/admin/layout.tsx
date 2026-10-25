import { Suspense } from "react";
import { AdminShell } from "@/components/admin/shell/admin-shell";
import { BrandLoader } from "@/components/brand/brand-loader";
import { getAdminAccess, getAdminSelf } from "@/lib/server-api/admin";

/**
 * The admin frame, outside the business app shell. The proxy already answers 404 to
 * signed-in non-admins; as a second line, the shell itself only renders after the API
 * confirms admin access, so no admin navigation reaches anyone else.
 */
async function AdminFrame({ children }: { children: React.ReactNode }) {
  const [, user] = await Promise.all([getAdminAccess(), getAdminSelf()]);
  return (
    <AdminShell
      user={{ name: user.name, email: user.email }}
      environment={process.env.NODE_ENV === "production" ? "production" : "development"}
    >
      {children}
    </AdminShell>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center p-6">
          <BrandLoader />
        </main>
      }
    >
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}
