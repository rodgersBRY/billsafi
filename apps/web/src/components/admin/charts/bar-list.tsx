"use client";

import { Bar, BarChart, ResponsiveContainer, useChartWidth, XAxis, YAxis } from "recharts";
import { useHydrated } from "@/lib/use-hydrated";
import { ChartCard } from "./chart-card";
import { seriesColors } from "./chart-utils";
import { useMotionOk } from "./use-motion-ok";

export interface BarListItem {
  label: string;
  /** The bar length, compared with `max`. */
  value: number;
  /** The text beside the bar, such as "42% (6 of 14)". */
  display: string;
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

const ROW = 46;
const BAR = 8;

interface RowShape {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { label: string; display: string };
}

/** One row: the label and figure on a line, then a track with the bar over it. */
function RowShape({ x = 0, y = 0, width = 0, height = 0, payload }: RowShape) {
  const chartWidth = useChartWidth() ?? 0;
  const right = x + chartWidth - 4;
  const base = y + height / 2 + BAR / 2;
  return (
    <g>
      <text x={x} y={base - BAR - 7} fill="var(--ink)" fontSize={14}>
        {payload?.label}
      </text>
      <text
        x={right}
        y={base - BAR - 7}
        textAnchor="end"
        fill="var(--ink)"
        fontSize={14}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {payload?.display}
      </text>
      <rect
        x={x}
        y={base - BAR}
        width={Math.max(chartWidth - 4, 0)}
        height={BAR}
        rx={4}
        fill="var(--soft)"
      />
      {width > 0 && (
        <rect x={x} y={base - BAR} width={width} height={BAR} rx={4} fill={seriesColors[0]} />
      )}
    </g>
  );
}

/** Labelled horizontal bars for a few categories, each with its figure beside it. */
export function BarList({ title, summary, items, max, valueHeading, emptyText }: BarListProps) {
  const mounted = useHydrated();
  const animate = useMotionOk();
  const full = max ?? Math.max(1, ...items.map((item) => item.value));
  const empty = items.length === 0 || items.every((item) => item.value === 0);
  const height = items.length * ROW;
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
      <div
        role="img"
        aria-label={`${title}. ${summary} The data is in the table below.`}
        className="w-full"
        style={{ height }}
      >
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={items}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              barCategoryGap={0}
              accessibilityLayer={false}
            >
              <XAxis type="number" hide domain={[0, full]} />
              <YAxis type="category" dataKey="label" hide />
              <Bar
                dataKey="value"
                shape={<RowShape />}
                isAnimationActive={animate}
                background={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}
