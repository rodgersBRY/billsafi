import type { AdminTenantRow } from "@billsafi/contracts";
import Link from "next/link";
import { formatCount, formatDay, formatInstant } from "../admin-format";
import { ClickableRow } from "../admin-link";
import { tenantHref } from "../admin-params";
import { accountActionBlock } from "../account-actions";
import { type Column, DataTable, tdClass } from "../data-table";
import { StatusBadge } from "../status-badge";
import { TenantRowMenu } from "./tenant-row-menu";
import { businessText, lastActivityText, planText } from "./tenant-text";

const columns: Column[] = [
  { label: "Owner and business", sort: "name", firstDir: "asc" },
  { label: "Plan" },
  { label: "Account" },
  { label: "Subscription" },
  { label: "Lifecycle" },
  { label: "Registered", sort: "registered" },
  { label: "Last activity", sort: "lastActivity" },
  { label: "Ready invoices", sort: "readyInvoices", align: "right" },
  { label: "Actions", srOnly: true },
];

interface TenantTableProps {
  tenants: AdminTenantRow[];
  selfId: string;
  sort: { sort: string; dir: "asc" | "desc" };
  sortHref: (sort: string, dir: "asc" | "desc") => string;
}

function Menu({ tenant, selfId }: { tenant: AdminTenantRow; selfId: string }) {
  return (
    <TenantRowMenu
      target={{ id: tenant.id, name: tenant.owner.name, email: tenant.owner.email }}
      href={tenantHref(tenant.id)}
      accountStatus={tenant.accountStatus}
      blocked={accountActionBlock({ isSelf: tenant.id === selfId })}
    />
  );
}

function TenantCards({ tenants, selfId }: Omit<TenantTableProps, "sort" | "sortHref">) {
  return (
    <ul className="divide-y divide-line">
      {tenants.map((tenant) => (
        <li key={tenant.id} className="flex items-start gap-2 p-4">
          <div className="min-w-0 flex-1">
            <Link
              href={tenantHref(tenant.id)}
              className="block font-medium break-words hover:text-accent hover:underline"
            >
              {tenant.owner.name}
            </Link>
            <p className="text-sm break-words text-sub">{businessText(tenant)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge kind="account" value={tenant.accountStatus} labelled />
              <StatusBadge kind="subscription" value={tenant.subscriptionStatus} labelled />
              <StatusBadge kind="lifecycle" value={tenant.lifecycleStage} labelled />
            </div>
            <p className="mt-2 text-xs text-sub">
              {planText(tenant.plan)}. Last activity{" "}
              {lastActivityText(tenant.lastMeaningfulActivityAt)}.
            </p>
          </div>
          <Menu tenant={tenant} selfId={selfId} />
        </li>
      ))}
    </ul>
  );
}

/** The tenants directory: a sortable table, and cards on phones. */
export function TenantTable({ tenants, selfId, sort, sortHref }: TenantTableProps) {
  return (
    <DataTable
      caption="Tenants"
      columns={columns}
      sort={sort}
      sortHref={sortHref}
      mobile={<TenantCards tenants={tenants} selfId={selfId} />}
    >
      {tenants.map((tenant) => (
        <ClickableRow key={tenant.id} href={tenantHref(tenant.id)}>
          <td className={`${tdClass} max-w-72 min-w-60`}>
            <Link
              href={tenantHref(tenant.id)}
              className="font-medium break-words hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {tenant.owner.name}
            </Link>
            <p className="text-xs break-all text-sub">{tenant.owner.email}</p>
            <p className="text-xs break-words text-sub">{businessText(tenant)}</p>
          </td>
          <td className={`${tdClass} whitespace-nowrap`}>{planText(tenant.plan)}</td>
          <td className={tdClass}>
            <StatusBadge kind="account" value={tenant.accountStatus} />
          </td>
          <td className={tdClass}>
            <StatusBadge kind="subscription" value={tenant.subscriptionStatus} />
          </td>
          <td className={tdClass}>
            <StatusBadge kind="lifecycle" value={tenant.lifecycleStage} />
          </td>
          <td className={`${tdClass} whitespace-nowrap text-sub`}>
            {formatDay(tenant.registeredAt)}
          </td>
          <td className={`${tdClass} whitespace-nowrap text-sub`}>
            {tenant.lastMeaningfulActivityAt ? (
              <time
                dateTime={tenant.lastMeaningfulActivityAt}
                title={formatInstant(tenant.lastMeaningfulActivityAt)}
              >
                {lastActivityText(tenant.lastMeaningfulActivityAt)}
              </time>
            ) : (
              lastActivityText(null)
            )}
          </td>
          <td className={`${tdClass} text-right tabular-nums`}>
            {formatCount(tenant.readyInvoices)}
          </td>
          <td className={`${tdClass} py-1.5 text-right`}>
            <Menu tenant={tenant} selfId={selfId} />
          </td>
        </ClickableRow>
      ))}
    </DataTable>
  );
}
