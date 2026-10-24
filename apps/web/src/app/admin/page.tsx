import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminView, fetchActiveTab } from "@/components/admin/admin-view";
import { parseAdminState } from "@/components/admin/admin-params";
import { BrandLoader } from "@/components/brand/brand-loader";

/**
 * The title waits for the API's answer, so a non-admin's not-found page keeps
 * the app's usual title instead of a static one that names the dashboard.
 */
export async function generateMetadata({ searchParams }: PageProps<"/admin">): Promise<Metadata> {
  await fetchActiveTab(parseAdminState(await searchParams));
  return { title: "Admin · Billsafi", robots: { index: false, follow: false } };
}

async function Dashboard({ searchParams }: PageProps<"/admin">) {
  return <AdminView state={parseAdminState(await searchParams)} />;
}

export default function AdminPage(props: PageProps<"/admin">) {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center p-6">
          <BrandLoader />
        </main>
      }
    >
      <Dashboard {...props} />
    </Suspense>
  );
}
