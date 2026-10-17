/** Kenya observes East Africa Time all year (UTC+3, no daylight saving). */
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface Period {
  start: Date;
  end: Date;
}

/**
 * The Free plan's calendar month in Africa/Nairobi time containing `at` (D044),
 * as UTC instants: start inclusive, end exclusive.
 */
export function nairobiCalendarMonth(at: Date): Period {
  const local = new Date(at.getTime() + NAIROBI_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - NAIROBI_OFFSET_MS),
    end: new Date(Date.UTC(year, month + 1, 1) - NAIROBI_OFFSET_MS),
  };
}
