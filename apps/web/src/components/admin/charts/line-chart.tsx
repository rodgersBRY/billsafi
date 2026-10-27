import { ChartShell, type ChartProps } from "./chart-shell";

/** One or more lines over time. Series share one axis, so keep them in the same unit. */
export function LineChart(props: ChartProps) {
  return <ChartShell mode="line" {...props} />;
}
