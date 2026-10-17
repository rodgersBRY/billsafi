import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { listBusinesses } from "@/lib/server-api/businesses";

/** Account billing has no business of its own; reminder emails link here (D051). */
async function Destination(): Promise<never> {
  const [first] = await listBusinesses();
  redirect(first ? `/${first.id}/billing` : "/onboarding");
}

export default function BillingRedirect() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Suspense fallback={<BrandLoader />}>
        <Destination />
      </Suspense>
    </main>
  );
}
