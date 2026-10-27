import { Suspense } from "react";
import { AccessGate } from "@/components/admin/access-gate";
import { adminMetadata } from "@/components/admin/admin-metadata";
import { UpdatedAt } from "@/components/admin/admin-ui";
import { HealthLinks, HealthSummary, IndicatorGrid } from "@/components/admin/health/health-view";
import { RefreshButton } from "@/components/admin/health/refresh-button";
import { InfoPopover } from "@/components/admin/info-popover";
import { PageHeader } from "@/components/admin/page-header";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { getAdminHealth } from "@/lib/server-api/admin";

export const generateMetadata = () => adminMetadata("System Health");

async function Health() {
  const health = await getAdminHealth();
  return (
    <>
      <PageHeader
        title="System Health"
        description="Is everything working?"
        actions={<RefreshButton />}
      />
      <HealthSummary indicators={health.indicators} />
      <h2 className="mb-3 flex items-center gap-1.5 text-base font-semibold">
        Checks
        <InfoPopover label="About these checks">
          <p>
            Unknown means the figure is not recorded yet or is too old to trust. Nothing shows as
            healthy without fresh data.
          </p>
        </InfoPopover>
      </h2>
      <IndicatorGrid health={health} now={new Date(health.generatedAt).getTime()} />
      <HealthLinks links={health.links} />
      <div className="mt-4">
        <UpdatedAt iso={health.generatedAt} cached={false} />
      </div>
    </>
  );
}

export default function HealthPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccessGate>
        <Health />
      </AccessGate>
    </Suspense>
  );
}
