"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useHydrated } from "@/lib/use-hydrated";
import { ChartCard } from "./chart-card";
import { formatTick, seriesColors } from "./chart-utils";
import { useMotionOk } from "./use-motion-ok";

export interface FirstInvoiceBar {
  label: string;
  count: number;
  /** Share of the sign-ups that are old enough to judge, as text such as "14%"; empty for "too new". */
  shareText: string;
  /** What the bar means for the tooltip, for example "Sign-ups under 7 days old". */
  note: string;
  /** Reached bars wear the series colour; the two waiting bars wear a muted neutral. */
  kind: "reached" | "not_yet" | "too_new";
}

interface Props {
  title: string;
  summary: string;
  bars: FirstInvoiceBar[];
  /** Sign-ups the shares are out of, named in the tooltip and the table heading. */
  base: number;
  emptyText: string;
}

const axisText = { fill: "var(--sub)", fontSize: 12 } as const;

/** Breaks a label into short lines so six categories fit side by side on a phone. */
function wrapLabel(label: string): string[] {
  const words = label.split(" ");
  if (label.length <= 8 || words.length < 3) return words.length === 2 ? words : [label];
  const half = words.length === 3 ? 1 : Math.ceil(words.length / 2);
  return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
}

function BarTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const lines = wrapLabel(payload?.value ?? "");
  return (
    <text x={x} y={y} textAnchor="middle" fill="var(--sub)" fontSize={12}>
      {lines.map((line, i) => (
        <tspan key={line} x={x} dy={i === 0 ? 12 : 14}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** The tallest bar plus room, rounded up to a tidy number. */
const headroom = (max: number) => (max <= 0 ? 1 : Math.max(Math.ceil(max * 1.15), 1));

function Tip({
  base,
  active,
  payload,
}: {
  base: number;
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: FirstInvoiceBar }>;
}) {
  const bar = payload?.[0]?.payload;
  if (!active || !bar) return null;
  return (
    <div className="rounded-panel border border-line bg-panel px-2.5 py-1.5 text-xs text-ink shadow-sm">
      <p className="font-medium whitespace-nowrap">{bar.label}</p>
      <p className="mt-1 whitespace-nowrap tabular-nums">
        {bar.count} {bar.count === 1 ? "account" : "accounts"}
        {bar.shareText ? ` (${bar.shareText} of ${base})` : ""}
      </p>
      <p className="whitespace-nowrap text-sub">{bar.note}</p>
    </div>
  );
}

/** Reached bars are solid series-1; "Not yet" is a muted solid; "Too new" is hollow, dashed. */
const fillOf = (kind: FirstInvoiceBar["kind"]) =>
  kind === "reached" ? seriesColors[0] : kind === "not_yet" ? "var(--sub)" : "var(--soft)";

/** Sign-ups by how long they took to make a first invoice Ready: vertical bars, counts up the side. */
export function FirstInvoiceChart({ title, summary, bars, base, emptyText }: Props) {
  const mounted = useHydrated();
  const animate = useMotionOk();
  const empty = bars.every((bar) => bar.count === 0);
  const table = {
    columns: ["Time to first invoice", "Accounts", `Share of ${base} sign-ups`],
    rows: bars.map((bar) => [bar.label, String(bar.count), bar.shareText || "Not counted"]),
  };

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
        className="h-60 w-full"
      >
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={bars}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              accessibilityLayer={false}
            >
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis
                dataKey="label"
                tick={<BarTick />}
                tickLine={false}
                axisLine={{ stroke: "var(--sub)" }}
                interval={0}
                height={44}
                tickMargin={2}
              />
              <YAxis
                width="auto"
                tickLine={false}
                axisLine={false}
                tick={axisText}
                allowDecimals={false}
                domain={[0, headroom]}
                tickFormatter={(value: number) => formatTick(value)}
              />
              <Tooltip
                isAnimationActive={false}
                cursor={{ fill: "var(--soft)", fillOpacity: 0.7 }}
                content={<Tip base={base} />}
              />
              <Bar
                dataKey="count"
                maxBarSize={48}
                radius={[4, 4, 0, 0]}
                isAnimationActive={animate}
              >
                {bars.map((bar) => (
                  <Cell
                    key={bar.label}
                    fill={fillOf(bar.kind)}
                    fillOpacity={bar.kind === "not_yet" ? 0.6 : 1}
                    stroke={bar.kind === "too_new" ? "var(--sub)" : "none"}
                    strokeDasharray={bar.kind === "too_new" ? "4 3" : undefined}
                    strokeWidth={bar.kind === "too_new" ? 1.5 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}
