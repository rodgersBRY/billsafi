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

/** Midnight in Nairobi at the start of the day containing `at`, as a UTC instant. */
export function nairobiDayStart(at: Date): Date {
  const local = new Date(at.getTime() + NAIROBI_OFFSET_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - NAIROBI_OFFSET_MS,
  );
}

/** Monday 00:00 in Nairobi of the week containing `at`, as a UTC instant. */
export function nairobiWeekStart(at: Date): Date {
  const day = nairobiDayStart(at);
  // getUTCDay of the shifted instant is the Nairobi weekday; Sunday (0) belongs to the week before.
  const weekday = new Date(day.getTime() + NAIROBI_OFFSET_MS).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return new Date(day.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Adds `months` anniversary months to `anchor` in Nairobi time. A day that the
 * target month lacks clamps to its last day, while later months still use the
 * original anchor day (D044): 31 January becomes 28 February, then 31 March.
 */
export function addNairobiMonths(anchor: Date, months: number): Date {
  const local = new Date(anchor.getTime() + NAIROBI_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + months;
  const target = new Date(Date.UTC(year, month, 1));
  const day = Math.min(
    local.getUTCDate(),
    daysInMonth(target.getUTCFullYear(), target.getUTCMonth()),
  );
  return new Date(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      day,
      local.getUTCHours(),
      local.getUTCMinutes(),
      local.getUTCSeconds(),
      local.getUTCMilliseconds(),
    ) - NAIROBI_OFFSET_MS,
  );
}

export interface ProPeriod extends Period {
  /** 0 for the first period after the anchor. */
  index: number;
}

/**
 * The paid Pro period containing `at`, or null when `at` falls outside paid
 * access. Prepaid months extend access without moving the current period.
 */
export function proPeriodAt(anchor: Date, paidMonths: number, at: Date): ProPeriod | null {
  if (paidMonths <= 0 || at < anchor || at >= addNairobiMonths(anchor, paidMonths)) return null;
  const localAnchor = new Date(anchor.getTime() + NAIROBI_OFFSET_MS);
  const localAt = new Date(at.getTime() + NAIROBI_OFFSET_MS);
  let index =
    (localAt.getUTCFullYear() - localAnchor.getUTCFullYear()) * 12 +
    localAt.getUTCMonth() -
    localAnchor.getUTCMonth();
  index = Math.min(Math.max(index, 0), paidMonths - 1);
  while (index > 0 && addNairobiMonths(anchor, index) > at) index--;
  while (index < paidMonths - 1 && addNairobiMonths(anchor, index + 1) <= at) index++;
  return {
    index,
    start: addNairobiMonths(anchor, index),
    end: addNairobiMonths(anchor, index + 1),
  };
}
