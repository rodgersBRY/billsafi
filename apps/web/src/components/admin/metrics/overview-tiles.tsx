import type { AdminOverview } from "@billsafi/contracts";
import { formatCount, formatKes, formatShare, formatUsd } from "../admin-format";
import { KpiCard, type KpiChange } from "../kpi-card";
import { describeChange, describeRateChange } from "./kpi-change";

interface Tile {
  label: string;
  value: string | null;
  definition: string;
  change?: KpiChange;
  detail?: string;
  href?: string;
}

const count = (pair: { current: number; previous: number }) =>
  describeChange(pair.current, pair.previous, formatCount(pair.previous));

const money = (pair: { current: string; previous: string }, format: (amount: string) => string) =>
  describeChange(Number(pair.current), Number(pair.previous), format(pair.previous));

function tiles(data: AdminOverview): Tile[] {
  const { definitions: d, signups, proChurn, activation, mpesa } = data;
  return [
    {
      label: "Total accounts",
      value: formatCount(data.totalAccounts.current),
      definition: d.totalAccounts,
      change: count(data.totalAccounts),
      href: "/admin/tenants",
    },
    {
      label: "New sign-ups",
      value: formatCount(signups.current.total),
      definition: d.signups,
      change: count({ current: signups.current.total, previous: signups.previous.total }),
      detail: `Google ${formatCount(signups.current.google)}, email ${formatCount(signups.current.email)}.`,
    },
    {
      label: "Active accounts",
      value: formatCount(data.activeAccounts.current),
      definition: d.activeAccounts,
      change: count(data.activeAccounts),
    },
    {
      label: "Activation rate",
      value: activation.current.rate === null ? null : formatShare(activation.current.rate),
      definition: d.activation,
      change: describeRateChange(activation.current.rate, activation.previous.rate),
      detail:
        activation.current.rate === null
          ? "No sign-ups in this range are 7 days old yet."
          : `${formatCount(activation.current.count)} of ${formatCount(activation.current.base)} sign-ups.`,
    },
    {
      label: "Paying accounts",
      value: formatCount(data.payingAccounts.current),
      definition: d.payingAccounts,
      change: count(data.payingAccounts),
      href: "/admin/subscriptions",
    },
    {
      label: "Complimentary Pro",
      value: formatCount(data.complimentaryProAccounts.current),
      definition: d.complimentaryProAccounts,
      change: count(data.complimentaryProAccounts),
    },
    {
      label: "MRR",
      value: formatUsd(data.mrrUsd.current),
      definition: d.mrrUsd,
      change: money(data.mrrUsd, formatUsd),
    },
    {
      label: "Pro churn",
      value: proChurn.current.rate === null ? null : formatShare(proChurn.current.rate),
      definition: d.proChurn,
      change: describeRateChange(proChurn.current.rate, proChurn.previous.rate),
      detail:
        proChurn.current.rate === null
          ? "No accounts had Pro at the start of this range."
          : `${formatCount(proChurn.current.count)} of ${formatCount(proChurn.current.base)} Pro accounts.`,
    },
    {
      label: "Invoices made Ready",
      value: formatCount(data.invoicesReady.current),
      definition: d.invoicesReady,
      change: count(data.invoicesReady),
    },
    {
      label: "KES collected",
      value: formatKes(data.collected.kes.current),
      definition: d.collected,
      change: money(data.collected.kes, formatKes),
    },
    {
      label: "USD collected",
      value: formatUsd(data.collected.usd.current),
      definition: "Manual payments in USD, by the day paid. Never converted to KES.",
      change: money(data.collected.usd, formatUsd),
    },
    {
      label: "Failed M-Pesa checkouts",
      value: formatCount(mpesa.current.failed),
      definition: d.mpesa,
      change: count({ current: mpesa.current.failed, previous: mpesa.previous.failed }),
      detail: `${formatCount(mpesa.current.succeeded)} succeeded.`,
    },
    {
      label: "M-Pesa success rate",
      value: mpesa.current.successRate === null ? null : formatShare(mpesa.current.successRate),
      definition: "Successful checkouts out of settled ones in this range.",
      change: describeRateChange(mpesa.current.successRate, mpesa.previous.successRate),
      detail:
        mpesa.current.successRate === null
          ? "No settled M-Pesa checkouts in this range."
          : undefined,
    },
  ];
}

/** The overview figures in a 4, 2 or 1 column grid. */
export function OverviewTiles({ data }: { data: AdminOverview }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles(data).map((tile) => (
        <li key={tile.label}>
          <KpiCard {...tile} />
        </li>
      ))}
    </ul>
  );
}
