import type { AdminOverview } from "@billsafi/contracts";
import { formatCount, formatKes, formatShare, formatUsd } from "../admin-format";
import { InfoPopover } from "../info-popover";
import type { KpiChange } from "../kpi-card";
import { describeCompactChange, describeCompactRateChange, type MetricKey } from "./kpi-change";
import { ChangeLine } from "./headline-row";

interface Row {
  label: string;
  /** Null shows a dash; the reason goes in the info popover. */
  value: string | null;
  definition: string;
  /** Why the value is missing, shown in the popover. */
  missing?: string;
  change?: KpiChange;
  subline?: string;
}

function Rows({ title, id, rows }: { title: string; id: string; rows: Row[] }) {
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-panel border border-line bg-panel p-4">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      <dl className="mt-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3 py-2">
            <dt className="flex items-center gap-1 text-sm text-sub">
              {row.label}
              <InfoPopover label={`What does ${row.label} mean?`}>
                {row.definition}
                {row.value === null && row.missing ? ` ${row.missing}` : ""}
              </InfoPopover>
            </dt>
            <dd className="min-w-0 text-right">
              <span className="block text-sm font-semibold tabular-nums">
                {row.value ?? (
                  <>
                    <span aria-hidden>-</span>
                    <span className="sr-only">Not available</span>
                  </>
                )}
              </span>
              {row.subline && <span className="block text-xs text-sub">{row.subline}</span>}
              {row.change && <ChangeLine change={row.change} className="justify-end text-xs" />}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const count = (metric: MetricKey, pair: { current: number; previous: number }) =>
  describeCompactChange(metric, pair.current, pair.previous);
const money = (metric: MetricKey, pair: { current: string; previous: string }) =>
  describeCompactChange(metric, Number(pair.current), Number(pair.previous));

export function RevenuePanel({ data }: { data: AdminOverview }) {
  const { definitions: d, proChurn, mpesa } = data;
  return (
    <Rows
      id="revenue-title"
      title="Revenue"
      rows={[
        {
          label: "KES collected",
          value: formatKes(data.collected.kes.current),
          definition: d.collected,
          change: money("kesCollected", data.collected.kes),
        },
        {
          label: "USD collected",
          value: formatUsd(data.collected.usd.current),
          definition: "Manual payments in USD, by the day paid. Never converted to KES.",
          change: money("usdCollected", data.collected.usd),
        },
        {
          label: "Paying accounts",
          value: formatCount(data.payingAccounts.current),
          definition: d.payingAccounts,
          change: count("payingAccounts", data.payingAccounts),
        },
        {
          label: "Complimentary Pro",
          value: formatCount(data.complimentaryProAccounts.current),
          definition: d.complimentaryProAccounts,
          change: count("complimentaryPro", data.complimentaryProAccounts),
        },
        {
          label: "Pro churn",
          value: proChurn.current.rate === null ? null : formatShare(proChurn.current.rate),
          definition: d.proChurn,
          missing: "No accounts had Pro at the start of this range, so there is no rate.",
          change: describeCompactRateChange(
            "proChurn",
            proChurn.current.rate,
            proChurn.previous.rate,
          ),
          subline:
            proChurn.current.rate === null
              ? undefined
              : `${formatCount(proChurn.current.count)} of ${formatCount(proChurn.current.base)} Pro accounts`,
        },
        {
          label: "Failed M-Pesa checkouts",
          value: formatCount(mpesa.current.failed),
          definition: d.mpesa,
          change: count("failedMpesa", {
            current: mpesa.current.failed,
            previous: mpesa.previous.failed,
          }),
          subline:
            mpesa.current.successRate === null
              ? "No settled checkouts"
              : `${formatShare(mpesa.current.successRate)} success rate`,
        },
      ]}
    />
  );
}

export function GrowthPanel({ data }: { data: AdminOverview }) {
  const { definitions: d, signups, activation } = data;
  return (
    <Rows
      id="growth-panel-title"
      title="Growth and activation"
      rows={[
        {
          label: "Total accounts",
          value: formatCount(data.totalAccounts.current),
          definition: d.totalAccounts,
          change: count("totalAccounts", data.totalAccounts),
        },
        {
          label: "Activation rate",
          value: activation.current.rate === null ? null : formatShare(activation.current.rate),
          definition: d.activation,
          missing: "No sign-ups in this range are 7 days old yet.",
          change: describeCompactRateChange(
            "activationRate",
            activation.current.rate,
            activation.previous.rate,
          ),
          subline:
            activation.current.rate === null
              ? undefined
              : `${formatCount(activation.current.count)} of ${formatCount(activation.current.base)} sign-ups`,
        },
        {
          label: "Sign-ups by method",
          value: `${formatCount(signups.current.google)} Google, ${formatCount(signups.current.email)} email`,
          definition:
            "New accounts in the range split by how they signed up. Google means the account has a Google login, email means it does not.",
        },
      ]}
    />
  );
}
