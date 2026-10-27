import { ChartShell, type ChartProps } from "./chart-shell";

/**
 * The first series as bars on the left axis, the second as a line on the right axis.
 * The two axes have their own scales, so use it only for a count and its running total.
 * The tick text of each axis wears its series colour, so the axes can be told apart.
 */
export function BarsAndLine(props: ChartProps) {
  return <ChartShell mode="combo" {...props} />;
}
