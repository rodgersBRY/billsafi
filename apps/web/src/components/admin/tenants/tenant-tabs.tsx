import { type TenantTab, tenantHref, tenantTabs } from "../admin-params";
import { UrlTabs } from "../url-tabs";

const labels: Record<TenantTab, string> = {
  overview: "Overview",
  businesses: "Businesses",
  subscription: "Subscription",
  usage: "Usage",
  activity: "Activity & Audit",
  support: "Support",
};

/** The account's sections, kept in the URL (?tab=). */
export function TenantTabs({ id, current }: { id: string; current: TenantTab }) {
  return (
    <UrlTabs
      label="Account sections"
      current={current}
      tabs={tenantTabs.map((tab) => ({ key: tab, label: labels[tab], href: tenantHref(id, tab) }))}
    />
  );
}
