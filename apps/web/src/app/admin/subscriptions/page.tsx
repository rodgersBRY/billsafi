import { Suspense } from "react";
import { adminMetadata } from "@/components/admin/admin-metadata";
import { BillingPanels } from "@/components/admin/metrics/billing-panels";
import { PlanReference } from "@/components/admin/metrics/plan-reference";
import { PageHeader } from "@/components/admin/page-header";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { getAdminBilling } from "@/lib/server-api/admin";

export const generateMetadata = () => adminMetadata("Subscriptions");

/** Everything waits for the billing data, so nothing renders before admin access is confirmed. */
async function Subscriptions() {
  const data = await getAdminBilling();
  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Plans and Billsafi's own plan payments. Invoice payments between tenants and their clients are never counted here."
      />
      <div className="space-y-4">
        <PlanReference />
        <BillingPanels data={data} />
      </div>
    </>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<PageSkeleton label="Loading subscriptions" />}>
      <Subscriptions />
    </Suspense>
  );
}
