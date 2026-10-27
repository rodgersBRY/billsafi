import { LifeBuoy } from "lucide-react";
import { Suspense } from "react";
import { AccessGate } from "@/components/admin/access-gate";
import { adminMetadata } from "@/components/admin/admin-metadata";
import { ComingSoon } from "@/components/admin/coming-soon";
import { PageHeader } from "@/components/admin/page-header";
import { PageSkeleton } from "@/components/admin/page-skeleton";

export const generateMetadata = () => adminMetadata("Support");

export default function SupportPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccessGate>
        <PageHeader title="Support" description="Cases and internal notes about accounts." />
        <ComingSoon
          phase={6}
          icon={LifeBuoy}
          planned={[
            "Support cases linked to an account, with status, severity, category and resolution.",
            "Internal notes that account owners never see.",
            "Open, recently updated and resolved lists.",
          ]}
          unavailable={[
            "A customer-facing inbox and full ticketing are out of scope. Support stays internal.",
          ]}
        />
      </AccessGate>
    </Suspense>
  );
}
