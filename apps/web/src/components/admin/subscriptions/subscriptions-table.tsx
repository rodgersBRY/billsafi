import type { AdminSubscriptionRow } from "@billsafi/contracts";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { formatCount, formatDay } from "../admin-format";
import { ClickableRow } from "../admin-link";
import { tenantHref } from "../admin-params";
import { type Column, DataTable, tdClass, tdNowrapClass } from "../data-table";
import { StatusBadge } from "../status-badge";
import { planText } from "../tenants/tenant-text";

const columns: Column[] = [
  { label: "Account", sort: "name", firstDir: "asc" },
  { label: "Plan" },
  { label: "Status" },
  { label: "Pro until", sort: "proUntil" },
  { label: "Current month" },
  { label: "Last payment", sort: "lastPayment" },
  { label: "Credits", align: "right" },
  { label: "Overrides" },
];

interface SubscriptionsTableProps {
  rows: AdminSubscriptionRow[];
  sort: { sort: string; dir: "asc" | "desc" };
  sortHref: (sort: string, dir: "asc" | "desc") => string;
}

const href = (id: string) => tenantHref(id, "subscription");

function lastPaymentText(payment: AdminSubscriptionRow["lastPayment"]): string {
  if (!payment) return "None";
  return `${formatMoney(payment.amount, payment.currency)} on ${formatDay(payment.date)}`;
}

function overridesText(overrides: AdminSubscriptionRow["activeOverrides"]): string {
  if (overrides.count === 0) return "None";
  return `${formatCount(overrides.count)} active, +${formatCount(overrides.extraInvoices)} invoices`;
}

function SourceBadge({ row }: { row: AdminSubscriptionRow }) {
  return row.currentMonthSource ? (
    <StatusBadge kind="source" value={row.currentMonthSource} labelled />
  ) : (
    <span className="text-sub">Not on Pro</span>
  );
}

function Cards({ rows }: { rows: AdminSubscriptionRow[] }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => (
        <li key={row.id} className="p-4">
          <Link
            href={href(row.id)}
            className="block font-medium break-words hover:text-accent hover:underline"
          >
            {row.owner.name}
          </Link>
          <p className="text-sm break-all text-sub">{row.owner.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <StatusBadge kind="subscription" value={row.subscriptionStatus} labelled />
            <SourceBadge row={row} />
          </div>
          <p className="mt-2 text-xs text-sub">
            {planText(row.plan)}. Credits {formatCount(row.credits)}. Last payment:{" "}
            {lastPaymentText(row.lastPayment)}. Overrides: {overridesText(row.activeOverrides)}.
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Every account's plan, sortable, with cards on phones. Rows open the Subscription tab. */
export function SubscriptionsTable({ rows, sort, sortHref }: SubscriptionsTableProps) {
  return (
    <DataTable
      caption="Subscriptions"
      columns={columns}
      sort={sort}
      sortHref={sortHref}
      mobile={<Cards rows={rows} />}
    >
      {rows.map((row) => (
        <ClickableRow key={row.id} href={href(row.id)}>
          <td className={`${tdClass} max-w-72 min-w-56`}>
            <Link
              href={href(row.id)}
              className="font-medium break-words hover:text-accent hover:underline"
            >
              {row.owner.name}
            </Link>
            <p className="text-xs break-all text-sub">{row.owner.email}</p>
          </td>
          <td className={tdNowrapClass}>{row.plan.label}</td>
          <td className={tdClass}>
            <StatusBadge kind="subscription" value={row.subscriptionStatus} />
          </td>
          <td className={`${tdNowrapClass} text-sub`}>
            {row.proUntil ? formatDay(row.proUntil) : "Never on Pro"}
            {row.cancelledAt && <span className="block text-xs">Asked not to renew</span>}
          </td>
          <td className={tdClass}>
            <SourceBadge row={row} />
          </td>
          <td className={`${tdNowrapClass} text-sub`}>
            {lastPaymentText(row.lastPayment)}
            {row.lastPayment?.provider === "manual" && (
              <span className="block text-xs">Recorded manually</span>
            )}
          </td>
          <td className={`${tdClass} text-right tabular-nums`}>{formatCount(row.credits)}</td>
          <td className={`${tdNowrapClass} text-sub`}>{overridesText(row.activeOverrides)}</td>
        </ClickableRow>
      ))}
    </DataTable>
  );
}
