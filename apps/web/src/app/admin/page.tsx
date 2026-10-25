import { CalendarClock } from "lucide-react";
import { Suspense } from "react";
import { adminMetadata } from "@/components/admin/admin-metadata";
import { UpdatedAt } from "@/components/admin/admin-ui";
import { NeedsAttention } from "@/components/admin/metrics/needs-attention";
import { OverviewTiles } from "@/components/admin/metrics/overview-tiles";
import { PageHeader } from "@/components/admin/page-header";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { getAdminBilling, getAdminOverview, getAdminTenants } from "@/lib/server-api/admin";

export const generateMetadata = () => adminMetadata("Overview");

/** Rendered with the data, after the API has confirmed admin access. */
const header = (
  <PageHeader
    title="Overview"
    description="Sign-ups, invoicing and Billsafi's own revenue at a glance. Times are Nairobi time."
  />
);

async function Overview() {
  const [overview, billing, suspended, ending] = await Promise.all([
    getAdminOverview(),
    getAdminBilling(),
    getAdminTenants("?accountStatus=suspended"),
    getAdminTenants("?subscriptionStatus=pro_ending"),
  ]);

  return (
    <>
      {header}
      <div className="space-y-6">
        <OverviewTiles data={overview} />
        <div className="grid gap-4 lg:grid-cols-2">
          <NeedsAttention
            items={[
              {
                label: "Stuck payments",
                count: billing.stuckPayments.length,
                help: "M-Pesa checkouts still pending more than 10 minutes after they started.",
                href: "/admin/subscriptions#stuck-payments",
              },
              {
                label: "Suspended accounts",
                count: suspended.total,
                help: "Accounts that can't sign in right now.",
                href: "/admin/tenants?accountStatus=suspended",
              },
              {
                label: "Pro ending soon",
                count: ending.total,
                help: "Pro access that ends within 7 days.",
                href: "/admin/tenants?subscriptionStatus=pro_ending",
              },
            ]}
          />
          <section className="rounded-panel border border-dashed border-line bg-panel p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <CalendarClock aria-hidden className="size-4.5 text-accent" />
              Coming in phase 4
            </h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-sub">
              <li>Tenant growth and subscription mix charts.</li>
              <li>A recent platform activity feed.</li>
              <li>Churn, renewals due and overdue subscriptions.</li>
              <li>A date range that applies to every figure on this page.</li>
            </ul>
            <p className="mt-3 text-xs text-sub">
              These need queries that are not built yet, so nothing is shown for them here.
            </p>
          </section>
        </div>
        <UpdatedAt iso={overview.generatedAt} />
      </div>
    </>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton label="Loading overview" />}>
      <Overview />
    </Suspense>
  );
}
