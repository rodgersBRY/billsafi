import { HeartPulse } from "lucide-react";
import { Suspense } from "react";
import { AccessGate } from "@/components/admin/access-gate";
import { adminMetadata } from "@/components/admin/admin-metadata";
import { ComingSoon } from "@/components/admin/coming-soon";
import { PageHeader } from "@/components/admin/page-header";
import { PageSkeleton } from "@/components/admin/page-skeleton";

export const generateMetadata = () => adminMetadata("System Health");

export default function HealthPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccessGate>
        <PageHeader
          title="System Health"
          description="Whether the database, payments and background jobs are working."
        />
        <ComingSoon
          phase={6}
          icon={HeartPulse}
          planned={[
            "Database connectivity, checked the same way as the API health check.",
            "M-Pesa success rate and stuck payments.",
            "When each billing job last ran, and failed PDF and email operations.",
            "The last successful backup and how old it is.",
            "Links to the uptime monitor and Sentry for availability, latency and errors.",
          ]}
          unavailable={[
            "Job runs, PDF and email failures and backup status are not recorded yet. Recording them is phase 5.",
            "API availability and latency live in the uptime monitor and Sentry. This page will link to them rather than copy them.",
            "Storage capacity, restore tests and incidents are out of scope for now.",
          ]}
        />
      </AccessGate>
    </Suspense>
  );
}
