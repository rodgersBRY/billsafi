import type { KpiChange } from "../kpi-card";
import { formatShare } from "../admin-format";

const percentFormat = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 });

/** Which way is good for each figure: "neutral" when neither direction is clearly better. */
type Better = "up" | "down" | "neutral";

export const metricBetter = {
  signups: "up",
  activeAccounts: "up",
  invoicesReady: "up",
  mrr: "up",
  kesCollected: "up",
  usdCollected: "up",
  payingAccounts: "up",
  totalAccounts: "up",
  activationRate: "up",
  proChurn: "down",
  failedMpesa: "down",
  complimentaryPro: "neutral",
} as const satisfies Record<string, Better>;

export type MetricKey = keyof typeof metricBetter;

/**
 * Text colours by meaning, each at least 4.5:1 on the panel in both themes: green moved the
 * good way, red the bad way, amber moved where neither way is clearly good, grey did not move.
 */
export const toneClasses: Record<NonNullable<KpiChange["tone"]>, string> = {
  good: "text-emerald-800 dark:text-emerald-300",
  bad: "text-red-700 dark:text-red-300",
  warn: "text-amber-800 dark:text-amber-300",
  none: "text-sub",
};

function toneOf(direction: KpiChange["direction"], better: Better): NonNullable<KpiChange["tone"]> {
  if (direction === "flat") return "none";
  if (better === "neutral") return "warn";
  return direction === better ? "good" : "bad";
}

const word = { up: "Up", down: "Down" } as const;

/** The same movement as `describeChange`, worded short for the Overview: "Up 12% on last period". */
export function describeCompactChange(
  metric: MetricKey,
  current: number,
  previous: number,
): KpiChange {
  const change = describeMove(current, previous);
  return { ...change, tone: toneOf(change.direction, metricBetter[metric]) };
}

function describeMove(current: number, previous: number): KpiChange {
  if (current === previous) return { direction: "flat", text: "No change on last period" };
  const direction = current > previous ? "up" : "down";
  if (previous === 0) return { direction, text: `${word[direction]} from 0 last period` };
  const percent = (Math.abs(current - previous) / Math.abs(previous)) * 100;
  const size = percent < 1 ? "less than 1%" : `${percentFormat.format(percent)}%`;
  return { direction, text: `${word[direction]} ${size} on last period` };
}

/** A rate moving between periods, worded short: "Up 3 points on last period". */
export function describeCompactRateChange(
  metric: MetricKey,
  current: number | null,
  previous: number | null,
): KpiChange {
  const change = describeRateMove(current, previous);
  return { ...change, tone: toneOf(change.direction, metricBetter[metric]) };
}

function describeRateMove(current: number | null, previous: number | null): KpiChange {
  if (previous === null) return { direction: "flat", text: "No figure for last period" };
  if (current === null)
    return { direction: "flat", text: `Last period was ${formatShare(previous)}` };
  const points = (current - previous) * 100;
  const rounded = Math.round(Math.abs(points) * 10) / 10;
  if (rounded === 0) return { direction: "flat", text: "No change on last period" };
  const direction = points > 0 ? "up" : "down";
  return {
    direction,
    text: `${word[direction]} ${rounded} ${rounded === 1 ? "point" : "points"} on last period`,
  };
}
