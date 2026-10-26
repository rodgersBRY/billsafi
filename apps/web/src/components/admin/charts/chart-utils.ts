import type { AdminBucketSize } from "@billsafi/contracts";

/** What a chart value counts, so values can be formatted without passing functions to client code. */
export type ChartUnit = "count" | "kes" | "usd";

/** Series colours, in fixed order (see --series-N in globals.css). Static strings keep Tailwind's scan working. */
export const seriesClasses = [
  { stroke: "stroke-series-1", fill: "fill-series-1", bg: "bg-series-1" },
  { stroke: "stroke-series-2", fill: "fill-series-2", bg: "bg-series-2" },
  { stroke: "stroke-series-3", fill: "fill-series-3", bg: "bg-series-3" },
] as const;

const countFormat = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 1 });
const compactFormat = new Intl.NumberFormat("en-KE", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const moneyFormat = new Intl.NumberFormat("en-KE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** A full value, for tooltips and tables. */
export function formatValue(value: number, unit: ChartUnit): string {
  if (unit === "count") return countFormat.format(value);
  return `${unit === "kes" ? "KES" : "USD"} ${moneyFormat.format(value)}`;
}

/** A short value for axis ticks. */
export function formatTick(value: number): string {
  return compactFormat.format(value);
}

/** A rounded-up top for the y axis and evenly spaced ticks from zero. */
export function niceScale(max: number, unit: ChartUnit): { top: number; ticks: number[] } {
  const wanted = 4;
  const raw = max > 0 ? max / wanted : 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const factor = [1, 2, 2.5, 5, 10].find((f) => f * magnitude >= raw) ?? 10;
  let step = factor * magnitude;
  if (unit === "count" && step < 1) step = 1;
  const count = Math.max(1, Math.ceil(max / step));
  return { top: step * count, ticks: Array.from({ length: count + 1 }, (_, i) => step * i) };
}

/** Which x labels to show: the last one always, then every Nth going back, so labels never collide. */
export function labelIndexes(length: number, room: number, labelWidth: number): Set<number> {
  const fit = Math.max(2, Math.floor(room / labelWidth));
  const step = Math.ceil(length / fit);
  const shown = new Set<number>();
  for (let i = length - 1; i >= 0; i -= step) shown.add(i);
  return shown;
}

const dayMonth = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const monthYear = new Intl.DateTimeFormat("en-KE", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});
const fullDay = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const fullMonth = new Intl.DateTimeFormat("en-KE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const asDate = (bucketStart: string) => new Date(`${bucketStart}T00:00:00Z`);

/** A short axis label for a bucket start (a Nairobi date). */
export function bucketLabel(bucketStart: string, size: AdminBucketSize): string {
  return size === "month"
    ? monthYear.format(asDate(bucketStart))
    : dayMonth.format(asDate(bucketStart));
}

/** A long label for tooltips and tables. */
export function bucketFullLabel(bucketStart: string, size: AdminBucketSize): string {
  const date = asDate(bucketStart);
  if (size === "month") return fullMonth.format(date);
  if (size === "week") return `Week of ${fullDay.format(date)}`;
  return fullDay.format(date);
}
