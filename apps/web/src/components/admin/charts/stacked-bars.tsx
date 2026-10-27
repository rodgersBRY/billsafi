import { ChartShell, type ChartProps } from "./chart-shell";

/** Bars per period, with several series stacked in order. One series makes plain bars. */
export function StackedBars(props: ChartProps) {
  return <ChartShell mode="bars" {...props} />;
}
