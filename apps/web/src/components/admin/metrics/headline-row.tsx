import type { AdminOverview } from "@billsafi/contracts";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { formatCount, formatUsd } from "../admin-format";
import { InfoPopover } from "../info-popover";
import type { KpiChange } from "../kpi-card";
import { describeCompactChange, sinceBasis, toneClasses } from "./kpi-change";

const changeIcons = { up: ArrowUp, down: ArrowDown, flat: Minus };

/** The movement since the previous period as an arrow and words, so it never relies on colour. */
export function ChangeLine({ change, className = "" }: { change: KpiChange; className?: string }) {
  const Icon = changeIcons[change.direction];
  return (
    <span className={`flex items-center gap-1 ${toneClasses[change.tone ?? "none"]} ${className}`}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {change.text}
    </span>
  );
}

interface Headline {
  label: string;
  value: string;
  definition: string;
  change: KpiChange;
  subline?: string;
}

function headlines(data: AdminOverview): Headline[] {
  const { definitions: d, signups } = data;
  return [
    {
      label: "New sign-ups",
      value: formatCount(signups.current.total),
      definition: d.signups,
      change: describeCompactChange("signups", signups.current.total, signups.previous.total),
    },
    {
      label: "Active accounts",
      value: formatCount(data.activeAccounts.current),
      definition: d.activeAccounts,
      change: describeCompactChange(
        "activeAccounts",
        data.activeAccounts.current,
        data.activeAccounts.previous,
      ),
    },
    {
      label: "Invoices made Ready",
      value: formatCount(data.invoicesReady.current),
      definition: d.invoicesReady,
      change: describeCompactChange(
        "invoicesReady",
        data.invoicesReady.current,
        data.invoicesReady.previous,
      ),
    },
    {
      label: "MRR",
      value: formatUsd(data.mrrUsd.current),
      definition: d.mrrUsd,
      change: describeCompactChange(
        "mrr",
        Number(data.mrrUsd.current),
        Number(data.mrrUsd.previous),
        sinceBasis(data.period.start),
      ),
      subline: `${formatCount(data.payingAccounts.current)} paying`,
    },
  ];
}

/** The four figures that matter most: 2 columns on a phone, 4 in a row on a wide screen. */
export function HeadlineRow({ data }: { data: AdminOverview }) {
  return (
    <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {headlines(data).map((item) => (
        <li
          key={item.label}
          className="flex min-w-0 flex-col rounded-panel border border-line bg-panel p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-sub">{item.label}</p>
            <InfoPopover label={`What does ${item.label} mean?`}>{item.definition}</InfoPopover>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
            {item.value}
          </p>
          {item.subline && <p className="mt-0.5 text-xs text-sub">{item.subline}</p>}
          <ChangeLine change={item.change} className="mt-2 text-xs font-medium" />
        </li>
      ))}
    </ul>
  );
}
