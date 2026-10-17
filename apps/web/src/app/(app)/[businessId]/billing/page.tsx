import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { BillingView } from "@/components/billing/billing-view";
import { getBusiness, listBusinesses } from "@/lib/api.server";
import { getBilling } from "@/lib/billing.server";

export const metadata: Metadata = { title: "Billing · TallyNest" };

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
