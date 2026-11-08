import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { RecurringDetails } from "@/components/recurring/recurring-details";
import { getUsage } from "@/lib/server-api/billing";
import { getRecurring } from "@/lib/server-api/recurring";

export const metadata: Metadata = { title: "Recurring invoice · BillSafi" };

async function RecurringScreen({ params }: PageProps<"/[businessId]/recurring/[recurringId]">) {
  const { businessId, recurringId } = await params;
  await connection();
  const [recurring, usage] = await Promise.all([getRecurring(businessId, recurringId), getUsage()]);
  return (
    <RecurringDetails
      key={`${recurring.id}:${recurring.updatedAt}`}
      businessId={businessId}
      recurring={recurring}
      isPro={usage.plan === "pro"}
    />
  );
}

export default function RecurringDetailPage(
  props: PageProps<"/[businessId]/recurring/[recurringId]">,
) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <RecurringScreen {...props} />
    </Suspense>
  );
}
