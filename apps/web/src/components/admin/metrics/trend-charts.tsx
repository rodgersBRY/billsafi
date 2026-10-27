import type { AdminTrends } from "@billsafi/contracts";
import { BarList } from "../charts/bar-list";
import { bucketFullLabel, bucketLabel } from "../charts/chart-utils";
import { BarsAndLine } from "../charts/bars-and-line";
import { GroupedBars } from "../charts/grouped-bars";
import { StackedBars } from "../charts/stacked-bars";
import { formatCount, formatKes, formatShare, formatUsd } from "../admin-format";

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function axis(data: AdminTrends) {
  return {
    labels: data.points.map((p) => bucketLabel(p.bucketStart, data.bucketSize)),
    fullLabels: data.points.map((p) => bucketFullLabel(p.bucketStart, data.bucketSize)),
  };
}

const unitWord = { day: "day", week: "week", month: "month" } as const;

/** New sign-ups as bars, with the running total of accounts as a line on its own axis. */
export function GrowthChart({ data }: { data: AdminTrends }) {
  const accounts = data.points.map((p) => p.accountsTotal);
  const signups = data.points.map((p) => p.signups);
  return (
    <BarsAndLine
      title="Account growth"
      summary={`${formatCount(accounts.at(-1) ?? 0)} accounts in total after ${formatCount(sum(signups))} new sign-ups in this range. Bars are new sign-ups per ${unitWord[data.bucketSize]} (left axis) and the line is the total at the end of each ${unitWord[data.bucketSize]} (right axis).`}
      {...axis(data)}
      series={[
        { name: "New sign-ups", values: signups },
        { name: "Total accounts", values: accounts },
      ]}
      unit="count"
      emptyText="No accounts yet. Growth shows here once people sign up."
    />
  );
}

/** Sign-ups next to first invoices made Ready. */
export function ActivationChart({ data }: { data: AdminTrends }) {
  const signups = data.points.map((p) => p.signups);
  const firsts = data.points.map((p) => p.firstInvoices);
  return (
    <GroupedBars
      title="Sign-ups and first invoices"
      summary={`${formatCount(sum(signups))} sign-ups next to ${formatCount(sum(firsts))} accounts that made their first invoice Ready, per ${unitWord[data.bucketSize]}.`}
      {...axis(data)}
      series={[
        { name: "Sign-ups", values: signups },
        { name: "First invoice made Ready", values: firsts },
      ]}
      unit="count"
      emptyText="No sign-ups or first invoices in this range."
    />
  );
}

/** Money collected per bucket; KES and USD are drawn apart and never added together. */
export function RevenueCharts({ data }: { data: AdminTrends }) {
  const kes = data.points.map((p) => Number(p.kesCollected));
  const usd = data.points.map((p) => Number(p.usdCollected));
  return (
    <>
      <StackedBars
        title="KES collected"
        summary={`${formatKes(sum(kes).toFixed(2))} collected in this range, per ${unitWord[data.bucketSize]}, by the day paid.`}
        {...axis(data)}
        series={[{ name: "KES collected", values: kes }]}
        unit="kes"
        emptyText="No KES payments in this range."
      />
      <StackedBars
        title="USD collected"
        summary={`${formatUsd(sum(usd).toFixed(2))} collected in this range, per ${unitWord[data.bucketSize]}, by the day paid. Kept apart from KES.`}
        {...axis(data)}
        series={[{ name: "USD collected", values: usd }]}
        unit="usd"
        emptyText="No USD payments in this range."
      />
    </>
  );
}

/** Where every account stands on plans right now. */
export function SubscriptionMix({ data }: { data: AdminTrends }) {
  const mix = data.subscriptionMix;
  const row = (label: string, value: number) => ({
    label,
    value,
    display: `${formatCount(value)} (${formatShare(mix.total === 0 ? null : value / mix.total)})`,
  });
  return (
    <BarList
      title="Subscription mix"
      summary={`Of ${formatCount(mix.total)} accounts right now, ${formatCount(mix.free)} are on Free and ${formatCount(mix.proPaid)} pay for Pro. Not affected by the range.`}
      items={[
        row("Free", mix.free),
        row("Pro, paid", mix.proPaid),
        row("Pro, complimentary", mix.proComplimentary),
        row("Pro ending within 7 days", mix.proEnding),
        row("Lapsed in the last 30 days", mix.lapsed),
      ]}
      max={mix.total}
      valueHeading="Accounts"
      emptyText="No accounts yet."
    />
  );
}
