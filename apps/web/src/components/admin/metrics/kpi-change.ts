import type { KpiChange } from "../kpi-card";
import { formatShare } from "../admin-format";

const percentFormat = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 });

/**
 * How a figure moved from the previous period, in words: "up 12% from 41". `previousText`
 * is the previous figure as it should read. Zero before is "up from 0", never a percent.
 */
export function describeChange(current: number, previous: number, previousText: string): KpiChange {
  if (current === previous) return { direction: "flat", text: `no change from ${previousText}` };
  const direction = current > previous ? "up" : "down";
  if (previous === 0) return { direction, text: `${direction} from ${previousText}` };
  const percent = (Math.abs(current - previous) / Math.abs(previous)) * 100;
  const size = percent < 1 ? "less than 1%" : `${percentFormat.format(percent)}%`;
  return { direction, text: `${direction} ${size} from ${previousText}` };
}

/** A rate moving between periods, in percentage points: "up 3 points from 41%". */
export function describeRateChange(current: number | null, previous: number | null): KpiChange {
  if (previous === null) return { direction: "flat", text: "no figure for the previous period" };
  if (current === null)
    return { direction: "flat", text: `previous period was ${formatShare(previous)}` };
  const points = (current - previous) * 100;
  const rounded = Math.round(Math.abs(points) * 10) / 10;
  if (rounded === 0) return { direction: "flat", text: `no change from ${formatShare(previous)}` };
  const direction = points > 0 ? "up" : "down";
  return {
    direction,
    text: `${direction} ${rounded} ${rounded === 1 ? "point" : "points"} from ${formatShare(previous)}`,
  };
}
