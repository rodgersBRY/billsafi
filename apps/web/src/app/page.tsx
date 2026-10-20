import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { listBusinesses } from "@/lib/server-api/businesses";

/** Sends signed-in users to their first business, or to setup if they have none. */
async function Destination(): Promise<never> {
  const businesses = await listBusinesses();
  const first = businesses[0];
  redirect(first ? `/${first.id}/overview` : "/onboarding");
}

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Suspense fallback={<BrandLoader />}>
        <Destination />
      </Suspense>
    </main>
  );
}
