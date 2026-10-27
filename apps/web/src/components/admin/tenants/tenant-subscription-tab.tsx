import type { AdminTenantSubscription } from "@billsafi/contracts";
import { CreditCard, Info } from "lucide-react";
import { formatCount, formatDay, formatInstant, formatKes, purposeLabels } from "../admin-format";
import { EmptyState, Panel, PaymentStatusPill } from "../admin-ui";
import { type Column, DataTable, tdClass } from "../data-table";
import { StatusBadge } from "../status-badge";
import { subscriptionStatusHelp } from "./status-explanations";
import { planText } from "./tenant-text";

const columns: Column[] = [
  { label: "Started" },
  { label: "For" },
  { label: "Amount", align: "right" },
  { label: "Status" },
  { label: "Phone" },
  { label: "Receipt" },
];

const day = (iso: string | null) => (iso ? formatDay(iso) : "Not set");

/** Read-only plan summary and the latest plan payments. */
export function TenantSubscriptionTab({ subscription }: { subscription: AdminTenantSubscription }) {
  const facts: [string, React.ReactNode][] = [
    ["Plan", planText(subscription.plan)],
    [
      "Status",
      <span key="status" className="inline-flex flex-wrap items-center gap-2">
        <StatusBadge kind="subscription" value={subscription.status} />
        <span className="text-sub">{subscriptionStatusHelp[subscription.status]}</span>
      </span>,
    ],
    ["Paid run started", day(subscription.anchorAt)],
    ["Paid months in this run", formatCount(subscription.paidMonths)],
    ["Paid until", day(subscription.paidUntil)],
    ["Asked not to renew", subscription.cancelledAt ? formatDay(subscription.cancelledAt) : "No"],
  ];
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-panel border border-line bg-panel px-4 py-3 text-sm text-sub">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
        Read only for now. Granting Pro months, ending Pro, adding credits and recording manual
        payments arrive in phase 3.
      </p>
      <Panel title="Subscription">
        <dl className="divide-y divide-line">
          {facts.map(([label, value]) => (
            <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm text-sub">{label}</dt>
              <dd className="text-sm sm:col-span-2">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel title="Recent plan payments" description="The 10 latest, newest first.">
        {subscription.recentPayments.length === 0 ? (
          <EmptyState icon={CreditCard} title="No plan payments" />
        ) : (
          <DataTable caption="Recent plan payments" columns={columns}>
            {subscription.recentPayments.map((payment) => (
              <tr key={payment.id} className="border-t border-line">
                <td className={`${tdClass} whitespace-nowrap text-sub`}>
                  {formatInstant(payment.createdAt)}
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>{purposeLabels[payment.purpose]}</td>
                <td className={`${tdClass} text-right whitespace-nowrap tabular-nums`}>
                  {formatKes(payment.amountKes)}
                </td>
                <td className={tdClass}>
                  <PaymentStatusPill status={payment.status} />
                </td>
                <td className={`${tdClass} whitespace-nowrap text-sub tabular-nums`}>
                  {payment.phone}
                </td>
                <td className={`${tdClass} text-sub`}>{payment.receipt ?? "None"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
