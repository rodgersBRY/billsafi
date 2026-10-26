"use client";

import { useEffect, useRef, useState } from "react";
import { ChartCard } from "./chart-card";
import {
  type ChartUnit,
  formatTick,
  formatValue,
  labelIndexes,
  niceScale,
  seriesClasses,
} from "./chart-utils";

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
}

const HEIGHT = 220;
const TOP = 12;
const BOTTOM = 28;
const RIGHT = 8;
const LABEL_WIDTH = 64;

/** The width the plot can use, kept up to date as the window or the layout changes. */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(node);
    setWidth(Math.floor(node.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** A line chart or stacked bar chart over time, drawn as SVG at the width it has. */
export function ChartShell({ mode, ...props }: ChartProps & { mode: "line" | "bars" }) {
  const { title, summary, labels, fullLabels, series, unit, emptyText } = props;
  const [ref, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);

  const count = labels.length;
  const empty = series.every((s) => s.values.every((v) => v === 0));
  const totals = labels.map((_, i) =>
    mode === "bars"
      ? series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)
      : Math.max(...series.map((s) => s.values[i] ?? 0)),
  );
  const { top, ticks } = niceScale(Math.max(0, ...totals), unit);

  const left = Math.max(...ticks.map((t) => formatTick(t).length)) * 6.5 + 14;
  const plotW = Math.max(width - left - RIGHT, 40);
  const plotH = HEIGHT - TOP - BOTTOM;
  const y = (value: number) => TOP + plotH - (value / top) * plotH;
  const band = plotW / Math.max(count, 1);
  const x = (index: number) =>
    mode === "bars" || count === 1
      ? left + band * (index + 0.5)
      : left + (plotW * index) / (count - 1);
  const shown = labelIndexes(count, plotW, LABEL_WIDTH);

  const move = (event: React.PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const offset = event.clientX - box.left;
    const index =
      mode === "bars" ? Math.floor(offset / band) : Math.round((offset / plotW) * (count - 1));
    setActive(Math.min(Math.max(index, 0), count - 1));
  };

  const table = {
    columns: ["Period", ...series.map((s) => s.name)],
    rows: labels.map((_, i) => [
      fullLabels[i] ?? "",
      ...series.map((s) => formatValue(s.values[i] ?? 0, unit)),
    ]),
  };

  const tipLeft = active === null ? 0 : x(active);
  const flip = tipLeft > width * 0.6;

  return (
    <ChartCard
      title={title}
      summary={summary}
      legend={series.map((s) => s.name)}
      emptyText={empty ? emptyText : undefined}
      table={table}
    >
      <div ref={ref} className="relative w-full overflow-hidden">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${title}. ${summary} The data is in the table below.`}
          className="block max-w-full select-none"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={left + plotW}
                y1={y(tick)}
                y2={y(tick)}
                className={tick === 0 ? "stroke-sub" : "stroke-line"}
                strokeWidth={1}
              />
              <text
                x={left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-sub text-xs"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {labels.map((label, i) =>
            shown.has(i) ? (
              <text
                key={i}
                x={x(i)}
                y={HEIGHT - 8}
                textAnchor={
                  i === 0 && mode === "line"
                    ? "start"
                    : i === count - 1 && mode === "line"
                      ? "end"
                      : "middle"
                }
                className="fill-sub text-xs"
              >
                {label}
              </text>
            ) : null,
          )}

          {mode === "line" ? (
            <>
              {active !== null && (
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={TOP}
                  y2={TOP + plotH}
                  className="stroke-sub"
                  strokeDasharray="3 3"
                />
              )}
              {series.map((s, si) => {
                const cls = seriesClasses[si] ?? seriesClasses[0];
                const points = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
                return (
                  <g key={s.name}>
                    <polyline
                      points={points}
                      fill="none"
                      className={cls.stroke}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {s.values.map((v, i) =>
                      count <= 14 || i === active ? (
                        <circle
                          key={i}
                          cx={x(i)}
                          cy={y(v)}
                          r={4}
                          className={`${cls.fill} stroke-panel`}
                          strokeWidth={2}
                        />
                      ) : null,
                    )}
                  </g>
                );
              })}
            </>
          ) : (
            <>
              {active !== null && (
                <rect
                  x={left + band * active}
                  y={TOP}
                  width={band}
                  height={plotH}
                  className="fill-soft"
                />
              )}
              {labels.map((_, i) => {
                const barW = Math.min(band * 0.72, 40);
                let base = 0;
                return series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  const start = base;
                  base += v;
                  if (v === 0) return null;
                  const cls = seriesClasses[si] ?? seriesClasses[0];
                  const segTop = y(start + v);
                  const segBottom = y(start) - (start > 0 ? 2 : 0);
                  const height = Math.max(segBottom - segTop, 1);
                  return (
                    <rect
                      key={`${i}-${s.name}`}
                      x={x(i) - barW / 2}
                      y={segBottom - height}
                      width={barW}
                      height={height}
                      rx={2}
                      className={cls.fill}
                    />
                  );
                });
              })}
            </>
          )}

          <rect
            x={left}
            y={TOP}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={move}
            onPointerDown={move}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
        {active !== null && (
          <div
            role="presentation"
            className="pointer-events-none absolute top-2 z-10 rounded-panel border border-line bg-panel px-2.5 py-1.5 text-xs shadow-sm"
            style={flip ? { right: width - tipLeft + 10 } : { left: tipLeft + 10 }}
          >
            <p className="font-medium whitespace-nowrap">{fullLabels[active]}</p>
            <ul className="mt-1 space-y-0.5">
              {series.map((s, si) => (
                <li key={s.name} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    aria-hidden
                    className={`size-2 rounded-full ${seriesClasses[si]?.bg ?? ""}`}
                  />
                  <span className="text-sub">{s.name}</span>
                  <span className="ml-auto pl-3 tabular-nums">
                    {formatValue(s.values[active] ?? 0, unit)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ChartCard>
  );
}
