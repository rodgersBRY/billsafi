import type { AdminBucketSize, AdminRange } from "@billsafi/contracts";
import { type SQL, sql } from "@billsafi/db";
import {
  addNairobiMonths,
  nairobiCalendarMonth,
  nairobiDate,
  nairobiDayStart,
  nairobiWeekStart,
} from "@billsafi/domain";
import { at, DAY_MS } from "../shared/admin-sql.js";

const WEEK_MS = 7 * DAY_MS;

/**
 * The date range of an Overview or Analytics page, cut on Nairobi days. The range ends at
 * `end` (now); the previous period has the same length and ends where the range starts.
 * Buckets: days for 7d and 30d, Monday weeks for 90d, calendar months for 12m. The first
 * bucket of a range starts at `start` even when that is part way through a week.
 */
export interface RangePlan {
  range: AdminRange;
  bucket: AdminBucketSize;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  /** Where bucket 0 would begin: `start`, or the Monday of its week for weekly buckets. */
  origin: Date;
  bucketCount: number;
}

const DAY_RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;

export function planRange(range: AdminRange, now: Date): RangePlan {
  if (range === "12m") {
    const start = addNairobiMonths(nairobiCalendarMonth(now).start, -11);
    return {
      range,
      bucket: "month",
      start,
      end: now,
      previousStart: addNairobiMonths(start, -12),
      previousEnd: start,
      origin: start,
      bucketCount: 12,
    };
  }
  const days = DAY_RANGES[range];
  const start = new Date(nairobiDayStart(now).getTime() - (days - 1) * DAY_MS);
  const common = {
    range,
    start,
    end: now,
    previousStart: new Date(start.getTime() - days * DAY_MS),
    previousEnd: start,
  };
  if (range === "90d") {
    const origin = nairobiWeekStart(start);
    return {
      ...common,
      bucket: "week",
      origin,
      bucketCount: Math.floor((now.getTime() - origin.getTime()) / WEEK_MS) + 1,
    };
  }
  return { ...common, bucket: "day", origin: start, bucketCount: days };
}

/** The 0-based bucket a timestamptz expression falls in; the caller bounds it to the range. */
export function bucketIndexSql(plan: RangePlan, instant: SQL): SQL<number> {
  const nairobi = sql`${instant} at time zone 'Africa/Nairobi'`;
  if (plan.bucket === "month") {
    const [year, month] = nairobiDate(plan.origin).split("-").map(Number) as [number, number];
    return sql<number>`((extract(year from ${nairobi}) * 12 + extract(month from ${nairobi}))
      - ${year * 12 + month})::int`;
  }
  const size = (plan.bucket === "week" ? WEEK_MS : DAY_MS) / 1000;
  return sql<number>`floor(extract(epoch from ${instant} - ${at(plan.origin)}) / ${size})::int`;
}

/** Start of bucket `index` (a column or expression) as a timestamptz. */
export function bucketStartSql(plan: RangePlan, index: SQL): SQL {
  if (plan.bucket === "month") {
    return sql`((${at(plan.origin)} at time zone 'Africa/Nairobi') + make_interval(months => ${index}))
      at time zone 'Africa/Nairobi'`;
  }
  const hours = plan.bucket === "week" ? 24 * 7 : 24;
  const start = sql`${at(plan.origin)} + make_interval(hours => ${hours} * ${index})`;
  return plan.bucket === "week" ? sql`greatest(${at(plan.start)}, ${start})` : start;
}

/** The generate_series of bucket indexes, as `b(i, bucket_start)`. */
export function bucketsSql(plan: RangePlan): SQL {
  return sql`select i, ${bucketStartSql(plan, sql`i`)} as bucket_start
    from generate_series(0, ${plan.bucketCount - 1}::int) as i`;
}
