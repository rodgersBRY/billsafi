import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { BillingView } from "@/components/billing/billing-view";
import { getBilling } from "@/lib/server-api/billing";
import { getBusiness, listBusinesses } from "@/lib/server-api/businesses";

export const metadata: Metadata = { title: "Billing · Billsafi" };

async function Billing({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const [billing, business, businesses] = await Promise.all([
    getBilling(),
    getBusiness(businessId),
    listBusinesses(),
  ]);
  return (
    <BillingView
      billing={billing}
      defaultPhone={business.phone}
      businessNames={businesses.map((item) => item.displayName)}
    />
  );
}

export default function BillingPage({ params }: PageProps<"/[businessId]/billing">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <Billing params={params} />
    </Suspense>
  );
}
