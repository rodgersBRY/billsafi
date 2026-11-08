export const recurringFrequencies = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type RecurringFrequency = (typeof recurringFrequencies)[number];

const MONTHS: Record<Exclude<RecurringFrequency, "weekly">, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * The run date of occurrence `index` (0 is the start date). Month-based schedules keep
 * the start day and clamp to the last day of short months: 31 Jan, 28 Feb, 31 Mar (D082).
 */
export function recurrenceDate(
  start: string,
  frequency: RecurringFrequency,
  index: number,
): string {
  const base = new Date(`${start}T00:00:00Z`);
  if (frequency === "weekly") {
    return new Date(base.getTime() + index * 7 * DAY_MS).toISOString().slice(0, 10);
  }
  const target = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + index * MONTHS[frequency], 1),
  );
  const day = Math.min(
    base.getUTCDate(),
    daysInMonth(target.getUTCFullYear(), target.getUTCMonth()),
  );
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day))
    .toISOString()
    .slice(0, 10);
}

export interface RecurringSchedule {
  startDate: string;
  frequency: RecurringFrequency;
  /** Occurrence index the schedule runs next. */
  nextIndex: number;
  endDate: string | null;
  maxCount: number | null;
  generatedCount: number;
}

export type RunPlan =
  | { kind: "wait" }
  | { kind: "end" }
  | {
      kind: "run";
      periodDate: string;
      /** Missed periods passed over; only the latest is created (D082). */
      skipped: number;
      nextIndex: number;
      /** Null when this run is the schedule's last. */
      nextRunDate: string | null;
    };

function withinEnd(schedule: RecurringSchedule, date: string) {
  return schedule.endDate === null || date <= schedule.endDate;
}

/** What the job should do for a schedule on `today` (a Nairobi date). */
export function planRun(schedule: RecurringSchedule, today: string): RunPlan {
  if (schedule.maxCount !== null && schedule.generatedCount >= schedule.maxCount) {
    return { kind: "end" };
  }
  const first = recurrenceDate(schedule.startDate, schedule.frequency, schedule.nextIndex);
  if (!withinEnd(schedule, first)) return { kind: "end" };
  if (first > today) return { kind: "wait" };

  let index = schedule.nextIndex;
  for (;;) {
    const following = recurrenceDate(schedule.startDate, schedule.frequency, index + 1);
    if (following > today || !withinEnd(schedule, following)) break;
    index++;
  }

  const nextIndex = index + 1;
  const nextDate = recurrenceDate(schedule.startDate, schedule.frequency, nextIndex);
  const countDone = schedule.maxCount !== null && schedule.generatedCount + 1 >= schedule.maxCount;
  return {
    kind: "run",
    periodDate: recurrenceDate(schedule.startDate, schedule.frequency, index),
    skipped: index - schedule.nextIndex,
    nextIndex,
    nextRunDate: countDone || !withinEnd(schedule, nextDate) ? null : nextDate,
  };
}

/** The next `count` run dates from `nextIndex`, stopping at the schedule's end. */
export function upcomingRunDates(schedule: RecurringSchedule, count: number): string[] {
  const dates: string[] = [];
  for (let offset = 0; dates.length < count; offset++) {
    if (schedule.maxCount !== null && schedule.generatedCount + offset >= schedule.maxCount) break;
    const date = recurrenceDate(
      schedule.startDate,
      schedule.frequency,
      schedule.nextIndex + offset,
    );
    if (!withinEnd(schedule, date)) break;
    dates.push(date);
  }
  return dates;
}

/** The first occurrence on or after `from`, for skipping ahead without creating an invoice. */
export function indexOnOrAfter(start: string, frequency: RecurringFrequency, from: string): number {
  let index = 0;
  while (recurrenceDate(start, frequency, index) < from) index++;
  return index;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Replaces `{month}` and `{year}` with the period's month name and year. */
export function fillPeriodPlaceholders(text: string, periodDate: string): string {
  const month = MONTH_NAMES[Number(periodDate.slice(5, 7)) - 1]!;
  return text.replace(/\{month\}/gi, month).replace(/\{year\}/gi, periodDate.slice(0, 4));
}
