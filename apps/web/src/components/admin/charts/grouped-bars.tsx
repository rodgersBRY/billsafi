import { ChartShell, type ChartProps } from "./chart-shell";

/** Bars per period with the series side by side, for counts that are small and sparse. */
export function GroupedBars(props: ChartProps) {
  return <ChartShell mode="grouped" {...props} />;
}
