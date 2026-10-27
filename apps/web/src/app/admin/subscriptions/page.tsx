import { Suspense } from "react";
import { adminMetadata } from "@/components/admin/admin-metadata";
import {
  limitHitsThisMonth,
  parseSubscriptionTab,
  type RawParams,
  type SubscriptionTab,
  subscriptionsHref,
  subscriptionTabs,
} from "@/components/admin/admin-params";
import { BillingPanels } from "@/components/admin/metrics/billing-panels";
import { PlanReference } from "@/components/admin/metrics/plan-reference";
import { PageHeader } from "@/components/admin/page-header";
import { PageSkeleton, TableSkeleton } from "@/components/admin/page-skeleton";
import { SubscriptionKpis } from "@/components/admin/subscriptions/subscription-kpis";
import {
  GrantsDirectory,
  OverridesDirectory,
  PaymentsDirectory,
  SubscriptionsDirectory,
} from "@/components/admin/subscriptions/subscription-tabs";
import { UrlTabs } from "@/components/admin/url-tabs";
import { getAdminBilling } from "@/lib/server-api/admin";

export const generateMetadata = () => adminMetadata("Subscriptions");

const labels: Record<SubscriptionTab, string> = {
  subscriptions: "Subscriptions",
  payments: "Payments",
  grants: "Grants",
  overrides: "Overrides",
  plans: "Plans",
};

async function PaymentsWithBilling({ raw }: { raw: RawParams }) {
  const thisMonthOnly = limitHitsThisMonth(raw);
  const billing = await getAdminBilling(thisMonthOnly);
  return (
    <div className="space-y-6">
      <PaymentsDirectory raw={raw} />
      <BillingPanels
        data={billing}
        thisMonthOnly={thisMonthOnly}
        clearLimitFilterHref={`${subscriptionsHref("payments")}#free-limit-hits`}
      />
    </div>
  );
}

function TabContent({ tab, raw }: { tab: SubscriptionTab; raw: RawParams }) {
  switch (tab) {
    case "subscriptions":
      return <SubscriptionsDirectory raw={raw} />;
    case "payments":
      return <PaymentsWithBilling raw={raw} />;
    case "grants":
      return <GrantsDirectory raw={raw} />;
    case "overrides":
      return <OverridesDirectory raw={raw} />;
    case "plans":
      return <PlanReference />;
  }
}

/** Waits for the KPI data, so nothing renders before admin access is confirmed. */
async function Subscriptions({ searchParams }: PageProps<"/admin/subscriptions">) {
  const raw = await searchParams;
  const tab = parseSubscriptionTab(raw);
  const kpis = await SubscriptionKpis();
  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Plans, BillSafi's own plan payments, gifts and limit overrides. Invoice payments between tenants and their clients are never counted here."
      />
      {kpis}
      <UrlTabs
        label="Subscription sections"
        current={tab}
        tabs={subscriptionTabs.map((key) => ({
          key,
          label: labels[key],
          href: subscriptionsHref(key),
        }))}
      />
      <Suspense
        key={tab}
        fallback={<TableSkeleton label={`Loading ${labels[tab].toLowerCase()}`} />}
      >
        <TabContent tab={tab} raw={raw} />
      </Suspense>
    </>
  );
}

export default function SubscriptionsPage(props: PageProps<"/admin/subscriptions">) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading subscriptions" />}>
      <Subscriptions {...props} />
    </Suspense>
  );
}
