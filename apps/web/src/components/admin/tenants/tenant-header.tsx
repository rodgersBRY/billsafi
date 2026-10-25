import type { AdminTenantDetail } from "@billsafi/contracts";
import { formatCount, formatDay, formatInstant } from "../admin-format";
import { accountActionBlock } from "../account-actions";
import { CopyButton } from "../copy-button";
import { StatusBadge } from "../status-badge";
import { AccountActionButton } from "./account-action-button";
import { lastActivityText } from "./tenant-text";

/** Who the tenant is, its three statuses, the account action and the summary strip. */
export function TenantHeader({ data, selfId }: { data: AdminTenantDetail; selfId: string }) {
  const { tenant, identity, usage } = data;
  const blocked = accountActionBlock({
    isSelf: tenant.id === selfId,
    isAdmin: identity.role === "admin",
  });
  const summary = [
    { label: "Businesses", value: formatCount(tenant.businesses.count) },
    { label: "Ready invoices", value: formatCount(tenant.readyInvoices) },
    { label: "Clients", value: formatCount(usage.clients) },
    {
      label: "Last activity",
      value: lastActivityText(tenant.lastMeaningfulActivityAt),
      title: tenant.lastMeaningfulActivityAt
        ? formatInstant(tenant.lastMeaningfulActivityAt)
        : undefined,
    },
  ];

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-80">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{tenant.owner.name}</h1>
          <p className="mt-1 text-sm break-words text-sub">
            {tenant.businesses.firstName ?? "No business yet"}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <StatusBadge kind="account" value={tenant.accountStatus} labelled />
            <StatusBadge kind="subscription" value={tenant.subscriptionStatus} labelled />
            <StatusBadge kind="lifecycle" value={tenant.lifecycleStage} labelled />
          </div>
          <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <div className="flex min-w-0 items-center gap-1">
              <dt className="whitespace-nowrap text-sub">Account ID</dt>
              <dd className="flex min-w-0 items-center">
                <code className="truncate font-mono text-xs">{tenant.id}</code>
                <CopyButton value={tenant.id} label="Copy account ID" />
              </dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-sub">Joined</dt>
              <dd>{formatDay(tenant.registeredAt)}</dd>
            </div>
            <div className="flex min-w-0 gap-1">
              <dt className="text-sub">Owner email</dt>
              <dd className="break-all">{tenant.owner.email}</dd>
            </div>
          </dl>
        </div>
        <AccountActionButton
          target={{ id: tenant.id, name: tenant.owner.name, email: tenant.owner.email }}
          accountStatus={tenant.accountStatus}
          blocked={blocked}
        />
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="bg-panel px-4 py-3">
            <dt className="text-xs text-sub">{item.label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums" title={item.title}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
