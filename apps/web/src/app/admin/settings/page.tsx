import { Settings } from "lucide-react";
import { Suspense } from "react";
import { AccessGate } from "@/components/admin/access-gate";
import { adminMetadata } from "@/components/admin/admin-metadata";
import { ComingSoon } from "@/components/admin/coming-soon";
import { PageHeader } from "@/components/admin/page-header";
import { PageSkeleton } from "@/components/admin/page-skeleton";

export const generateMetadata = () => adminMetadata("Configuration");

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccessGate>
        <PageHeader title="Configuration" description="Platform-wide switches and messages." />
        <ComingSoon
          phase={6}
          icon={Settings}
          planned={[
            "Turning new registrations on or off.",
            "A maintenance or announcement banner for the app and the landing page.",
            "Support contact details.",
          ]}
          unavailable={[
            "Plan prices and limits are set in code, so they can't be edited here.",
            "Email templates live in code.",
            "Feature flags will only be added when a feature needs one.",
            "Secrets are never shown or entered in the admin.",
          ]}
        />
      </AccessGate>
    </Suspense>
  );
}
