import { type AdminRange, adminRanges } from "@billsafi/contracts";
import { formatDay } from "./admin-format";
import { InfoPopover } from "./info-popover";
import { PeriodSwitch } from "./admin-ui";
import { rangeDefaults, toQuery } from "./admin-params";

const labels: Record<AdminRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "12m": "12 months",
};

interface RangePickerProps {
  /** The page path, such as "/admin". */
  path: string;
  current: AdminRange;
  /** Other URL params to keep when the range changes. */
  keep?: Record<string, string | undefined>;
  period: { start: string; end: string };
  previousPeriod?: { start: string; end: string };
}

/** "27 Sept 2026" and "26 Oct 2026" as "27 Sept - 26 Oct 2026": the year is said once when it is shared. */
function compact(start: string, end: string): string {
  const year = end.slice(-4);
  return `${start.endsWith(year) ? start.slice(0, -5) : start} - ${end}`;
}

const lastDay = (end: string) => formatDay(new Date(Date.parse(end) - 1).toISOString());

/** The date range control, with the two periods it covers written out. */
export function RangePicker({
  path,
  current,
  keep = {},
  period,
  previousPeriod,
}: RangePickerProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <PeriodSwitch
        label="Date range"
        options={adminRanges.map((range) => ({
          label: labels[range],
          href: `${path}${toQuery({ ...keep, range }, rangeDefaults)}`,
          current: range === current,
        }))}
      />
      <div className="flex items-center gap-1 text-sm text-sub">
        {compact(formatDay(period.start), formatDay(period.end))}
        {previousPeriod && (
          <InfoPopover label="Which period is this compared with?">
            Compared with {compact(formatDay(previousPeriod.start), lastDay(previousPeriod.end))}
          </InfoPopover>
        )}
      </div>
    </div>
  );
}
