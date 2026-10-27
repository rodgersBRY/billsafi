import { notFound } from "next/navigation";
import { Suspense } from "react";
import { adminMetadata } from "@/components/admin/admin-metadata";
import { parseTenantTab, type TenantTab } from "@/components/admin/admin-params";
import { Panel, UpdatedAt } from "@/components/admin/admin-ui";
import { AuditTimeline } from "@/components/admin/audit/audit-timeline";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { TenantBusinessesTab } from "@/components/admin/tenants/tenant-businesses-tab";
import { TenantHeader } from "@/components/admin/tenants/tenant-header";
import { TenantOverviewTab } from "@/components/admin/tenants/tenant-overview-tab";
import { TenantSubscriptionTab } from "@/components/admin/tenants/tenant-subscription-tab";
import { TenantSupportTab } from "@/components/admin/tenants/tenant-support-tab";
import { TenantTabs } from "@/components/admin/tenants/tenant-tabs";
import { TenantUsageTab } from "@/components/admin/tenants/tenant-usage-tab";
import { getAdminAccess, getAdminSelf, getAdminTenant } from "@/lib/server-api/admin";
import type { AdminTenantDetail } from "@billsafi/contracts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The tenant, or the not-found page for an id that can't be one. */
async function loadTenant(params: Promise<{ id: string }>) {
  const { id } = await params;
  // Admin access first, so a malformed id can't tell a non-admin the area exists.
  await getAdminAccess();
  if (!UUID.test(id)) notFound();
  return getAdminTenant(id);
}

export async function generateMetadata({ params }: PageProps<"/admin/tenants/[id]">) {
  const data = await loadTenant(params);
  return adminMetadata(`${data.tenant.owner.name} · Tenants`);
}

interface TabContentProps {
  tab: TenantTab;
  data: AdminTenantDetail;
  selfId: string;
}

function TabContent({ tab, data, selfId }: TabContentProps) {
  switch (tab) {
    case "overview":
      return <TenantOverviewTab data={data} />;
    case "businesses":
      return <TenantBusinessesTab businesses={data.businesses} />;
    case "subscription":
      return <TenantSubscriptionTab data={data} selfId={selfId} />;
    case "usage":
      return <TenantUsageTab usage={data.usage} overrides={data.subscription.overrides} />;
    case "activity":
      return (
        <Panel
          title="Activity & Audit"
          description="The 20 latest admin actions about this account or its owner."
        >
          <AuditTimeline entries={data.recentAudit} targetId={data.tenant.id} />
        </Panel>
      );
    case "support":
      return <TenantSupportTab data={data} selfId={selfId} />;
  }
}

async function TenantDetail({ params, searchParams }: PageProps<"/admin/tenants/[id]">) {
  const [data, self, raw] = await Promise.all([loadTenant(params), getAdminSelf(), searchParams]);
  const tab = parseTenantTab(raw);
  return (
    <>
      <TenantHeader data={data} selfId={self.id} />
      <TenantTabs id={data.tenant.id} current={tab} />
      <div className="space-y-3">
        <TabContent tab={tab} data={data} selfId={self.id} />
        <UpdatedAt iso={data.generatedAt} cached={false} />
      </div>
    </>
  );
}

export default function TenantPage(props: PageProps<"/admin/tenants/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading account" />}>
      <TenantDetail {...props} />
    </Suspense>
  );
}
