import { Suspense } from "react";
import { adminMetadata } from "@/components/admin/admin-metadata";
import {
  funnelDaysFor,
  parseRangeParams,
  retentionWeeksFor,
} from "@/components/admin/admin-params";
import { UpdatedAt } from "@/components/admin/admin-ui";
import {
  FeatureAdoption,
  InvoiceVolume,
  PlanLimit,
  TimeToFirstInvoice,
  TopAccounts,
} from "@/components/admin/metrics/analytics-panels";
import { FunnelPanel } from "@/components/admin/metrics/funnel-panel";
import { RetentionPanel } from "@/components/admin/metrics/retention-panel";
import { PageHeader } from "@/components/admin/page-header";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { RangePicker } from "@/components/admin/range-picker";
import { getAdminAnalytics, getAdminFunnel, getAdminRetention } from "@/lib/server-api/admin";

export const generateMetadata = () => adminMetadata("Analytics");

/** Rendered with the data, after the API has confirmed admin access. */
const header = (
  <PageHeader
    title="Analytics"
    description="How new accounts get going, whether they keep invoicing and which features they use. PDF downloads and link opens come with event tracking."
  />
);

async function Analytics({ searchParams }: PageProps<"/admin/analytics">) {
  const { range } = parseRangeParams(await searchParams);
  const [analytics, funnel, retention] = await Promise.all([
    getAdminAnalytics(range),
    getAdminFunnel(funnelDaysFor[range]),
    getAdminRetention(retentionWeeksFor[range]),
  ]);

  return (
    <>
      {header}
      <RangePicker path="/admin/analytics" current={range} period={analytics.period} />
      <div className="space-y-10">
        <FunnelPanel data={funnel} />
        <RetentionPanel data={retention} />
        <InvoiceVolume data={analytics} />
        <TimeToFirstInvoice data={analytics} />
        <FeatureAdoption data={analytics} />
        <PlanLimit data={analytics} />
        <TopAccounts data={analytics} />
        <UpdatedAt iso={analytics.generatedAt} />
      </div>
    </>
  );
}

export default function AnalyticsPage(props: PageProps<"/admin/analytics">) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading analytics" />}>
      <Analytics {...props} />
    </Suspense>
  );
}
