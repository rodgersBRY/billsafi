import type { AdminBucketSize } from "@billsafi/contracts";

/** What a chart value counts, so values can be formatted without passing functions to client code. */
export type ChartUnit = "count" | "kes" | "usd";

/** Series colours, in fixed order. They are CSS variables, so light and dark need no script (see globals.css). */
export const seriesColors = ["var(--series-1)", "var(--series-2)", "var(--series-3)"] as const;

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
