"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { useHydrated } from "@/lib/use-hydrated";
import { type ChartUnit, formatValue } from "./chart-utils";
import { useMotionOk } from "./use-motion-ok";

interface SparklineProps {
  values: number[];
  /** One long label per value, shown in the tooltip. */
  labels: string[];
  unit: ChartUnit;
}

interface Row {
  label: string;
  value: number;
}

function Tip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: Row }>;
  unit: ChartUnit;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-panel border border-line bg-panel px-2 py-1 text-xs text-ink shadow-sm">
      <span className="text-sub">{row.label}</span>{" "}
      <span className="font-medium tabular-nums">{formatValue(row.value, unit)}</span>
    </div>
  );
}

/**
 * A tiny line with a soft fill under a headline figure: no axes, no grid. It repeats what the
 * change text already says, so it is hidden from screen readers. The box has a fixed height,
 * so the card does not move when the chart mounts.
 */
export function Sparkline({ values, labels, unit }: SparklineProps) {
  const mounted = useHydrated();
  const animate = useMotionOk();
  const data: Row[] = values.map((value, i) => ({ value, label: labels[i] ?? "" }));
  const max = Math.max(0, ...values);
  return (
    <div aria-hidden className="mt-3 h-9 w-full">
      {mounted && values.length > 1 && (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 3, right: 3, bottom: 2, left: 3 }}>
            <YAxis hide domain={[0, max > 0 ? max : 1]} />
            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: "var(--sub)", strokeDasharray: "3 3" }}
              content={<Tip unit={unit} />}
              allowEscapeViewBox={{ x: false, y: true }}
            />
            <Area
              dataKey="value"
              type="linear"
              stroke="var(--series-1)"
              strokeWidth={2}
              fill="var(--series-1)"
              fillOpacity={0.12}
              dot={false}
              activeDot={{ r: 3, fill: "var(--series-1)", stroke: "var(--panel)", strokeWidth: 2 }}
              isAnimationActive={animate}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
