import { Suspense } from "react";
import { AccessGate } from "@/components/admin/access-gate";
import { adminMetadata } from "@/components/admin/admin-metadata";
import { UpdatedAt } from "@/components/admin/admin-ui";
import { InfoPopover } from "@/components/admin/info-popover";
import { PageHeader } from "@/components/admin/page-header";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { SettingCard } from "@/components/admin/settings/setting-cards";
import { getAdminSettings } from "@/lib/server-api/admin";

export const generateMetadata = () => adminMetadata("Configuration");

async function Settings() {
  const data = await getAdminSettings();
  return (
    <>
      <PageHeader
        title="Configuration"
        description="Platform-wide switches."
        actions={
          <InfoPopover label="About configuration">
            <p>
              Every change needs a reason and is audited. Plan prices, limits, email templates and
              secrets are not editable here.
            </p>
          </InfoPopover>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {data.settings.map((setting) => (
          <SettingCard key={setting.key} setting={setting} />
        ))}
      </div>
      <div className="mt-4">
        <UpdatedAt iso={data.generatedAt} cached={false} />
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccessGate>
        <Settings />
      </AccessGate>
    </Suspense>
  );
}
