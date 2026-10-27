import type { AdminTenantDetail } from "@billsafi/contracts";
import { formatDay } from "../admin-format";
import { Panel } from "../admin-ui";
import { roleLabels, StatusBadge } from "../status-badge";
import { accountStatusHelp, lifecycleHelp, subscriptionStatusHelp } from "./status-explanations";
import { planText } from "./tenant-text";

const methodLabels = { email: "Email and password", google: "Google" } as const;

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-line">
      {items.map(([label, value]) => (
        <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm text-sub">{label}</dt>
          <dd className="text-sm break-words sm:col-span-2">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Identity and the three statuses, each with what it means. */
export function TenantOverviewTab({ data }: { data: AdminTenantDetail }) {
  const { tenant, identity } = data;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Identity" description="The owner's sign-in details.">
        <Facts
          items={[
            ["Name", tenant.owner.name],
            [
              "Email",
              <span key="email" className="break-all">
                {tenant.owner.email}
              </span>,
            ],
            ["Email verified", identity.emailVerified ? "Yes" : "No"],
            [
              "Sign-in methods",
              identity.signInMethods.map((method) => methodLabels[method]).join(", ") || "None",
            ],
            ["Platform role", roleLabels[identity.role]],
            ["Registered", formatDay(tenant.registeredAt)],
          ]}
        />
      </Panel>
      <Panel
        title="Statuses"
        description="Kept apart on purpose: a suspended account can still be on Pro."
      >
        <Facts
          items={[
            [
              "Account",
              <div key="account" className="space-y-1">
                <StatusBadge kind="account" value={tenant.accountStatus} />
                <p className="text-sub">{accountStatusHelp[tenant.accountStatus]}</p>
                {identity.suspendedReason && (
                  <p>
                    <span className="text-sub">Reason given: </span>
                    {identity.suspendedReason}
                  </p>
                )}
              </div>,
            ],
            [
              "Subscription",
              <div key="subscription" className="space-y-1">
                <StatusBadge kind="subscription" value={tenant.subscriptionStatus} />
                <p className="text-sub">
                  {subscriptionStatusHelp[tenant.subscriptionStatus]} Plan: {planText(tenant.plan)}.
                </p>
              </div>,
            ],
            [
              "Lifecycle",
              <div key="lifecycle" className="space-y-1">
                <StatusBadge kind="lifecycle" value={tenant.lifecycleStage} />
                <p className="text-sub">{lifecycleHelp[tenant.lifecycleStage]}</p>
              </div>,
            ],
          ]}
        />
      </Panel>
    </div>
  );
}
