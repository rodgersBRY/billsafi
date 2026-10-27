import type { AdminTenantDetail } from "@billsafi/contracts";
import { ArrowRight, CreditCard, Gauge, Gift } from "lucide-react";
import Link from "next/link";
import { formatCount, formatDay } from "../admin-format";
import { subscriptionsHref } from "../admin-params";
import { EmptyState, Panel } from "../admin-ui";
import { StatusBadge } from "../status-badge";
import { SubscriptionActions } from "../subscription-actions/subscription-actions";
import { GrantsTable } from "../subscriptions/grants-table";
import { OverridesTable } from "../subscriptions/overrides-table";
import { PaymentsTable } from "../subscriptions/payments-table";
import { subscriptionStatusHelp } from "./status-explanations";
import { planText } from "./tenant-text";

const day = (iso: string | null) => (iso ? formatDay(iso) : "Not set");

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-line">
      {items.map(([label, value]) => (
        <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm text-sub">{label}</dt>
          <dd className="text-sm sm:col-span-2">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The account's plan, the actions that change it, and its payment, gift and override history. */
export function TenantSubscriptionTab({
  data,
  selfId,
}: {
  data: AdminTenantDetail;
  selfId: string;
}) {
  const { tenant, subscription, usage } = data;
  const active = subscription.overrides.filter((row) => row.state === "active");
  const extra = active.reduce((sum, row) => sum + row.extraInvoices, 0);

  const facts: [string, React.ReactNode][] = [
    ["Plan", planText(subscription.plan)],
    [
      "Statuses",
      <span key="statuses" className="flex flex-wrap items-center gap-1.5">
        <StatusBadge kind="account" value={tenant.accountStatus} labelled />
        <StatusBadge kind="subscription" value={subscription.status} labelled />
        <StatusBadge kind="lifecycle" value={tenant.lifecycleStage} labelled />
      </span>,
    ],
    [
      "Pro until",
      <span key="until" className="flex flex-wrap items-center gap-2">
        {day(subscription.paidUntil)}
        {subscription.currentMonthSource && (
          <StatusBadge kind="source" value={subscription.currentMonthSource} labelled />
        )}
        <span className="basis-full text-xs text-sub">
          {subscriptionStatusHelp[subscription.status]}
        </span>
      </span>,
    ],
    ["Paid run started", day(subscription.anchorAt)],
    ["Months in this run", formatCount(subscription.paidMonths)],
    ["Asked not to renew", subscription.cancelledAt ? formatDay(subscription.cancelledAt) : "No"],
    ["Invoice credits", `${formatCount(usage.credits)} (bought and granted, not used yet)`],
    [
      "Limit overrides",
      active.length === 0
        ? "None active"
        : `${formatCount(active.length)} active, +${formatCount(extra)} invoices`,
    ],
  ];

  return (
    <div className="space-y-4">
      <Panel title="Plan actions" description="Each action asks for a reason and is audited.">
        <div className="p-4">
          <SubscriptionActions
            isSelf={tenant.id === selfId}
            context={{
              target: { id: tenant.id, name: tenant.owner.name, detail: tenant.owner.email },
              pro: { anchorAt: subscription.anchorAt, paidMonths: subscription.paidMonths },
              credits: usage.credits,
              limit: usage.allowance.limit,
            }}
          />
        </div>
      </Panel>
      <Panel title="Subscription">
        <Facts items={facts} />
      </Panel>
      <Panel
        title="Plan payments"
        description={`The ${formatCount(subscription.payments.length)} latest of ${formatCount(subscription.paymentCount)}, M-Pesa and manual, newest first.`}
        actions={
          <Link
            href={subscriptionsHref("payments", { search: tenant.id })}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-accent hover:underline md:min-h-0"
          >
            View all in Payments
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        }
      >
        {subscription.payments.length === 0 ? (
          <EmptyState icon={CreditCard} title="No plan payments" />
        ) : (
          <PaymentsTable payments={subscription.payments} showAccount={false} />
        )}
      </Panel>
      <Panel
        title="Complimentary grants"
        description="Gifts at no charge. Never counted as revenue."
      >
        {subscription.grants.length === 0 ? (
          <EmptyState icon={Gift} title="No grants" />
        ) : (
          <GrantsTable grants={subscription.grants} showAccount={false} />
        )}
      </Panel>
      <Panel
        title="Limit overrides"
        description="Every override, revoked and expired ones included."
      >
        {subscription.overrides.length === 0 ? (
          <EmptyState icon={Gauge} title="No limit overrides" />
        ) : (
          <OverridesTable overrides={subscription.overrides} showAccount={false} />
        )}
      </Panel>
    </div>
  );
}
