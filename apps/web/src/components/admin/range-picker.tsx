import { type AdminRange, adminRanges } from "@billsafi/contracts";
import { formatDay } from "./admin-format";
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
      <p className="text-sm text-sub">
        {formatDay(period.start)} to {formatDay(period.end)}
        {previousPeriod &&
          `, compared with ${formatDay(previousPeriod.start)} to ${lastDay(previousPeriod.end)}`}
        . Nairobi time.
      </p>
    </div>
  );
}
