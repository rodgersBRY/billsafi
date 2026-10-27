import type { AdminOverview, AdminSignupCounts } from "@billsafi/contracts";
import { formatCount, formatKes, formatShare, formatUsd } from "../admin-format";
import { KpiCard } from "../kpi-card";

interface Tile {
  label: string;
  value: string | null;
  definition: string;
  href?: string;
}

const share = (value: number | null) => (value === null ? null : formatShare(value));

function signupTile(label: string, counts: AdminSignupCounts, window: string): Tile {
  return {
    label,
    value: formatCount(counts.total),
    definition: `${window} Google ${formatCount(counts.google)}, email ${formatCount(counts.email)}.`,
  };
}

function tiles(data: AdminOverview): Tile[] {
  return [
    signupTile("Sign-ups today", data.signups.today, "Since midnight Nairobi time."),
    signupTile("Sign-ups, 7 days", data.signups.last7Days, "Today and the 6 days before."),
    signupTile("Sign-ups, 30 days", data.signups.last30Days, "Today and the 29 days before."),
    {
      label: "Active businesses",
      value: formatCount(data.activeBusinesses),
      definition: "Businesses with an invoice made Ready in the last 30 days.",
    },
    {
      label: "Invoices created",
      value: formatCount(data.invoicesCreatedThisMonth),
      definition: "Invoices started this calendar month.",
    },
    {
      label: "Invoices made Ready",
      value: formatCount(data.invoicesReadyThisMonth),
      definition: "Invoices made Ready this calendar month.",
    },
    {
      label: "Total accounts",
      value: formatCount(data.totalAccounts),
      definition: "Every account that has signed up.",
      href: "/admin/tenants",
    },
    {
      label: "Paying accounts",
      value: formatCount(data.payingAccounts),
      definition: "Accounts whose Pro access has not ended.",
      href: "/admin/tenants?lifecycle=subscribed",
    },
    {
      label: "Conversion",
      value: share(data.conversion),
      definition: "Accounts that ever paid for a plan, out of all accounts.",
    },
    {
      label: "MRR",
      value: formatUsd(data.mrrUsd),
      definition: "Paying accounts times the Pro price in USD.",
    },
    {
      label: "Collected this month",
      value: formatKes(data.kesCollectedThisMonth),
      definition: "Successful plan payments confirmed this calendar month.",
    },
    {
      label: "M-Pesa success rate",
      value: share(data.mpesaSuccessRate30Days),
      definition: "Successful checkouts out of settled ones in the last 30 days.",
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
