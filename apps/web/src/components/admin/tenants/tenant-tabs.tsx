import Link from "next/link";
import { type TenantTab, tenantHref, tenantTabs } from "../admin-params";

const labels: Record<TenantTab, string> = {
  overview: "Overview",
  businesses: "Businesses",
  subscription: "Subscription",
  usage: "Usage",
  activity: "Activity & Audit",
  support: "Support",
};

/** Tab links kept in the URL (?tab=), so each tab can be linked and reloaded. */
export function TenantTabs({ id, current }: { id: string; current: TenantTab }) {
  return (
    <nav aria-label="Account sections" className="mb-4 overflow-x-auto border-b border-line">
      <ul className="flex gap-1">
        {tenantTabs.map((tab) => (
          <li key={tab}>
            <Link
              href={tenantHref(id, tab)}
              replace
              scroll={false}
              aria-current={tab === current ? "page" : undefined}
              className="-mb-px inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm whitespace-nowrap text-sub hover:text-ink aria-[current=page]:border-teal aria-[current=page]:font-medium aria-[current=page]:text-ink"
            >
              {labels[tab]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
