import { Suspense } from "react";
import { adminMetadata } from "@/components/admin/admin-metadata";
import { parseAnalyticsParams, toQuery } from "@/components/admin/admin-params";
import { FunnelPanel } from "@/components/admin/metrics/funnel-panel";
import { RetentionPanel } from "@/components/admin/metrics/retention-panel";
import { PageHeader } from "@/components/admin/page-header";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { getAdminFunnel, getAdminRetention } from "@/lib/server-api/admin";

export const generateMetadata = () => adminMetadata("Analytics");

/** Rendered with the data, after the API has confirmed admin access. */
const header = (
  <PageHeader
    title="Analytics"
    description="How new accounts get going and whether they keep invoicing. Feature adoption and churn arrive in phase 4."
  />
);

const defaults = { days: 30, weeks: 8 };

async function Analytics({ searchParams }: PageProps<"/admin/analytics">) {
  const state = parseAnalyticsParams(await searchParams);
  const [funnel, retention] = await Promise.all([
    getAdminFunnel(state.days),
    getAdminRetention(state.weeks),
  ]);
  const href = (changes: Partial<typeof state>) =>
    `/admin/analytics${toQuery({ ...state, ...changes }, defaults)}`;

  return (
    <>
      {header}
      <div className="space-y-10">
        <FunnelPanel data={funnel} hrefFor={(days) => href({ days })} />
        <RetentionPanel data={retention} hrefFor={(weeks) => href({ weeks })} />
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
