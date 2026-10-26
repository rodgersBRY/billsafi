import Link from "next/link";
import { ChartCard } from "./chart-card";

export interface BarListItem {
  label: string;
  /** The bar length, compared with `max`. */
  value: number;
  /** The text beside the bar, such as "42% (6 of 14)". */
  display: string;
  href?: string;
}

interface BarListProps {
  title: string;
  summary: string;
  items: BarListItem[];
  /** What a full bar means; defaults to the largest value. */
  max?: number;
  /** Header for the value column in the data table. */
  valueHeading: string;
  emptyText: string;
}

/** Labelled horizontal bars for a few categories, each with its figure beside it. */
export function BarList({ title, summary, items, max, valueHeading, emptyText }: BarListProps) {
  const full = max ?? Math.max(1, ...items.map((item) => item.value));
  const empty = items.length === 0 || items.every((item) => item.value === 0);
  return (
    <ChartCard
      title={title}
      summary={summary}
      emptyText={empty ? emptyText : undefined}
      table={{
        columns: ["Item", valueHeading],
        rows: items.map((item) => [item.label, item.display]),
      }}
    >
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              {item.href ? (
                <Link href={item.href} className="min-w-0 break-words text-accent hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="min-w-0 break-words">{item.label}</span>
              )}
              <span className="shrink-0 tabular-nums">{item.display}</span>
            </div>
            <div aria-hidden className="mt-1 h-2 overflow-hidden rounded-full bg-soft">
              <div
                className="h-full rounded-full bg-series-1"
                style={{ width: `${Math.min(Math.max(item.value / full, 0), 1) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
