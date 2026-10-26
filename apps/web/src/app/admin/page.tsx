import { Suspense } from "react";
import { adminMetadata } from "@/components/admin/admin-metadata";
import { parseRangeParams } from "@/components/admin/admin-params";
import { UpdatedAt } from "@/components/admin/admin-ui";
import { ActivityFeed } from "@/components/admin/metrics/activity-feed";
import { NeedsAttention } from "@/components/admin/metrics/needs-attention";
import { OverviewTiles } from "@/components/admin/metrics/overview-tiles";
import {
  ActivationChart,
  GrowthChart,
  RevenueCharts,
  SubscriptionMix,
} from "@/components/admin/metrics/trend-charts";
import { PageHeader } from "@/components/admin/page-header";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { RangePicker } from "@/components/admin/range-picker";
import { getAdminActivity, getAdminOverview, getAdminTrends } from "@/lib/server-api/admin";

export const generateMetadata = () => adminMetadata("Overview");

/** Rendered with the data, after the API has confirmed admin access. */
const header = (
  <PageHeader
    title="Overview"
    description="Sign-ups, invoicing and BillSafi's own revenue for the range you pick, next to the period before it. Times are Nairobi time."
  />
);

async function Overview({ searchParams }: PageProps<"/admin">) {
  const { range } = parseRangeParams(await searchParams);
  const [overview, trends, activity] = await Promise.all([
    getAdminOverview(range),
    getAdminTrends(range),
    getAdminActivity(20),
  ]);
  const { attention: a } = overview;

  return (
    <>
      {header}
      <RangePicker
        path="/admin"
        current={range}
        period={overview.period}
        previousPeriod={overview.previousPeriod}
      />
      <div className="space-y-6">
        <OverviewTiles data={overview} />
        <div className="grid gap-4 lg:grid-cols-2">
          <GrowthChart data={trends} />
          <ActivationChart data={trends} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SubscriptionMix data={trends} />
          <div className="grid min-w-0 gap-4">
            <RevenueCharts data={trends} />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <NeedsAttention
            items={[
              {
                label: "Stuck payments",
                count: a.stuckPayments,
                help: "M-Pesa checkouts still pending more than 10 minutes after they started.",
                href: "/admin/subscriptions?tab=payments&stuck=true",
              },
              {
                label: "Suspended accounts",
                count: a.suspendedAccounts,
                help: "Accounts that can't sign in right now.",
                href: "/admin/tenants?accountStatus=suspended",
              },
              {
                label: "Pro ending soon",
                count: a.proEnding,
                help: "Pro access that ends within 7 days.",
                href: "/admin/subscriptions?renewalWithin=7",
              },
              {
                label: "Pro lapsed",
                count: a.proLapsed,
                help: "Pro that ended in the last 30 days and has not come back.",
                href: "/admin/subscriptions?lapsedWithin=30",
              },
              {
                label: "Free limit reached",
                count: a.freeLimitReached,
                help: "Free accounts that used all their invoices this month.",
                href: "/admin/subscriptions?tab=payments&limitHits=this_month#free-limit-hits",
              },
              {
                label: "Overrides ending",
                count: a.overridesEnding,
                help: "Limit overrides that end within 7 days.",
                href: "/admin/subscriptions?tab=overrides&endingWithin=7",
              },
            ]}
          />
          <ActivityFeed items={activity.items} now={Date.parse(activity.generatedAt)} />
        </div>
        <UpdatedAt iso={overview.generatedAt} />
      </div>
    </>
  );
}

export default function OverviewPage(props: PageProps<"/admin">) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading overview" />}>
      <Overview {...props} />
    </Suspense>
  );
}
