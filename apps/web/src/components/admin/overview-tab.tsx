import type { AdminOverview, AdminSignupCounts } from "@billsafi/contracts";
import { formatCount, formatKes, formatShare, formatUsd } from "./admin-format";
import { UpdatedAt } from "./admin-ui";

interface Tile {
  label: string;
  value: string;
  definition: string;
}

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
    },
    {
      label: "Paying accounts",
      value: formatCount(data.payingAccounts),
      definition: "Accounts whose Pro access has not ended.",
    },
    {
      label: "Conversion",
      value: formatShare(data.conversion),
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
      value: formatShare(data.mpesaSuccessRate30Days),
      definition: "Successful checkouts out of settled ones in the last 30 days.",
    },
  ];
}

export function OverviewTab({ data }: { data: AdminOverview }) {
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles(data).map((tile) => (
          <li key={tile.label} className="rounded-panel border border-line bg-panel p-4">
            <p className="text-sm text-sub">{tile.label}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
              {tile.value}
            </p>
            <p className="mt-1.5 text-xs text-sub">{tile.definition}</p>
          </li>
        ))}
      </ul>
      <UpdatedAt iso={data.generatedAt} />
    </div>
  );
}
