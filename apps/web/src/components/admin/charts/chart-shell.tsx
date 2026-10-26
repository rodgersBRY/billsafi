"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart as RechartsLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useHydrated } from "@/lib/use-hydrated";
import { ChartCard } from "./chart-card";
import { type ChartUnit, formatTick, formatValue, seriesColors } from "./chart-utils";
import { useMotionOk } from "./use-motion-ok";

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartProps {
  title: string;
  summary: string;
  /** Short x labels (shown a few at a time) and long ones (tooltip and table). */
  labels: string[];
  fullLabels: string[];
  series: ChartSeries[];
  unit: ChartUnit;
  emptyText: string;
  /** Extra text per period, shown in the tooltip under the figures. */
  notes?: string[];
  /** An extra table column, one text per period (for example a conversion rate). */
  extraColumn?: { heading: string; values: string[] };
  /** Combo charts only: titles for the left (bars) and right (line) axes. */
  axisTitles?: [string, string];
}

type Mode = "line" | "bars" | "grouped" | "combo";

type Row = Record<string, string | number>;

const axisText = { fill: "var(--sub)", fontSize: 12 } as const;
const axisLabel = { style: { fill: "var(--sub)", fontSize: 12, textAnchor: "middle" } } as const;
const colorOf = (index: number) => seriesColors[index] ?? seriesColors[0];

/** Hover card in the theme's panel colours: the full date, then one line per series. */
function TipCard({
  active,
  payload,
  series,
  unit,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: Row }>;
  series: ChartSeries[];
  unit: ChartUnit;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-panel border border-line bg-panel px-2.5 py-1.5 text-xs text-ink shadow-sm">
      <p className="font-medium whitespace-nowrap">{row.full}</p>
      <ul className="mt-1 space-y-0.5">
        {series.map((s, index) => (
          <li key={s.name} className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: colorOf(index) }}
            />
            <span className="text-sub">{s.name}</span>
            <span className="ml-auto pl-3 tabular-nums">
              {formatValue(Number(row[`s${index}`] ?? 0), unit)}
            </span>
          </li>
        ))}
      </ul>
      {row.note ? <p className="mt-1 whitespace-nowrap text-sub">{row.note}</p> : null}
    </div>
  );
}

/** A line chart or stacked bar chart over time, drawn by Recharts at the width it has. */
export function ChartShell({ mode, ...props }: ChartProps & { mode: Mode }) {
  const { title, summary, labels, fullLabels, series, unit, emptyText } = props;
  const { notes, extraColumn, axisTitles } = props;
  const mounted = useHydrated();
  const animate = useMotionOk();

  const empty = series.every((s) => s.values.every((v) => v === 0));
  const many = series.length > 1;
  // Fixed from the props alone, so the placeholder and the chart are the same size.
  const height = (many ? 260 : 220) + (mode === "combo" ? 10 : 0);

  const data: Row[] = labels.map((label, i) => {
    const row: Row = { label, full: fullLabels[i] ?? label, note: notes?.[i] ?? "" };
    series.forEach((s, si) => {
      row[`s${si}`] = s.values[i] ?? 0;
    });
    return row;
  });

  const table = {
    columns: [
      "Period",
      ...series.map((s) => s.name),
      ...(extraColumn ? [extraColumn.heading] : []),
    ],
    rows: labels.map((_, i) => [
      fullLabels[i] ?? "",
      ...series.map((s) => formatValue(s.values[i] ?? 0, unit)),
      ...(extraColumn ? [extraColumn.values[i] ?? ""] : []),
    ]),
  };

  const common = {
    data,
    margin: { top: 8, right: mode === "combo" ? 4 : 12, bottom: 0, left: 0 },
    accessibilityLayer: false,
  };
  const parts = [
    <CartesianGrid key="grid" vertical={false} stroke="var(--line)" />,
    <XAxis
      key="x"
      dataKey="label"
      tick={axisText}
      tickLine={false}
      axisLine={{ stroke: "var(--sub)" }}
      interval="preserveStartEnd"
      minTickGap={24}
      tickMargin={6}
    />,
    <YAxis
      key="y"
      width="auto"
      tick={axisText}
      tickLine={false}
      axisLine={false}
      yAxisId="left"
      allowDecimals={unit !== "count"}
      domain={[0, "auto"]}
      tickFormatter={(value: number) => formatTick(value)}
      label={
        mode === "combo" && axisTitles
          ? { value: axisTitles[0], angle: -90, position: "insideLeft", ...axisLabel }
          : undefined
      }
    />,
    mode === "combo" ? (
      <YAxis
        key="y2"
        yAxisId="right"
        orientation="right"
        width="auto"
        tick={axisText}
        tickLine={false}
        axisLine={false}
        allowDecimals={false}
        domain={[0, "auto"]}
        tickFormatter={(value: number) => formatTick(value)}
        label={
          axisTitles
            ? { value: axisTitles[1], angle: 90, position: "insideRight", ...axisLabel }
            : undefined
        }
      />
    ) : null,
    <Tooltip
      key="tip"
      isAnimationActive={false}
      cursor={
        mode === "line" || mode === "combo"
          ? { stroke: "var(--sub)", strokeDasharray: "3 3" }
          : { fill: "var(--soft)", fillOpacity: 0.7 }
      }
      content={<TipCard series={series} unit={unit} />}
    />,
    many ? (
      <Legend
        key="legend"
        verticalAlign="top"
        align="left"
        itemSorter={null}
        iconType="circle"
        iconSize={10}
        wrapperStyle={{ paddingBottom: 8, fontSize: 12 }}
        formatter={(value: string) => <span className="text-ink">{value}</span>}
      />
    ) : null,
  ];

  return (
    <ChartCard
      title={title}
      summary={summary}
      emptyText={empty ? emptyText : undefined}
      table={table}
    >
      <div
        role="img"
        aria-label={`${title}. ${summary} The data is in the table below.`}
        className="w-full"
        style={{ height }}
      >
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            {mode === "line" ? (
              <RechartsLine {...common}>
                {parts}
                {series.map((s, si) => (
                  <Line
                    key={s.name}
                    yAxisId="left"
                    name={s.name}
                    dataKey={`s${si}`}
                    type="linear"
                    stroke={colorOf(si)}
                    strokeWidth={2}
                    dot={
                      labels.length <= 14
                        ? { r: 4, fill: colorOf(si), stroke: "var(--panel)", strokeWidth: 2 }
                        : false
                    }
                    activeDot={{ r: 4, fill: colorOf(si), stroke: "var(--panel)", strokeWidth: 2 }}
                    isAnimationActive={animate}
                  />
                ))}
              </RechartsLine>
            ) : mode === "combo" ? (
              <ComposedChart {...common}>
                {parts}
                <Bar
                  yAxisId="left"
                  name={series[0]?.name}
                  dataKey="s0"
                  fill={colorOf(0)}
                  maxBarSize={32}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={animate}
                />
                <Line
                  yAxisId="right"
                  name={series[1]?.name}
                  dataKey="s1"
                  type="linear"
                  stroke={colorOf(1)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: colorOf(1), stroke: "var(--panel)", strokeWidth: 2 }}
                  isAnimationActive={animate}
                />
              </ComposedChart>
            ) : (
              <BarChart {...common}>
                {parts}
                {series.map((s, si) => (
                  <Bar
                    key={s.name}
                    yAxisId="left"
                    name={s.name}
                    dataKey={`s${si}`}
                    stackId={mode === "bars" ? "total" : undefined}
                    fill={colorOf(si)}
                    stroke={mode === "bars" ? "var(--panel)" : undefined}
                    strokeWidth={mode === "bars" ? 1 : 0}
                    maxBarSize={mode === "bars" ? 40 : 24}
                    radius={
                      mode === "bars" ? (si === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]
                    }
                    isAnimationActive={animate}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}
