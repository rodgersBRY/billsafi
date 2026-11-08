import { describe, expect, it } from "vitest";
import {
  fillPeriodPlaceholders,
  indexOnOrAfter,
  planRun,
  recurrenceDate,
  type RecurringSchedule,
  upcomingRunDates,
} from "./recurring.js";

const monthly = (overrides: Partial<RecurringSchedule> = {}): RecurringSchedule => ({
  startDate: "2026-01-31",
  frequency: "monthly",
  nextIndex: 0,
  endDate: null,
  maxCount: null,
  generatedCount: 0,
  ...overrides,
});

describe("recurrenceDate", () => {
  it("clamps month ends and keeps the start day", () => {
    expect([0, 1, 2, 3].map((n) => recurrenceDate("2026-01-31", "monthly", n))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("handles weekly, quarterly and leap-day yearly schedules", () => {
    expect(recurrenceDate("2026-12-28", "weekly", 1)).toBe("2027-01-04");
    expect(recurrenceDate("2026-11-30", "quarterly", 1)).toBe("2027-02-28");
    expect(recurrenceDate("2028-02-29", "yearly", 1)).toBe("2029-02-28");
    expect(recurrenceDate("2028-02-29", "yearly", 4)).toBe("2032-02-29");
  });
});

describe("planRun", () => {
  it("waits until the run date", () => {
    expect(planRun(monthly(), "2026-01-30")).toEqual({ kind: "wait" });
  });

  it("runs on the date and points at the next one", () => {
    expect(planRun(monthly(), "2026-01-31")).toEqual({
      kind: "run",
      periodDate: "2026-01-31",
      skipped: 0,
      nextIndex: 1,
      nextRunDate: "2026-02-28",
    });
  });

  it("creates only the latest missed period", () => {
    expect(planRun(monthly(), "2026-04-02")).toEqual({
      kind: "run",
      periodDate: "2026-03-31",
      skipped: 2,
      nextIndex: 3,
      nextRunDate: "2026-04-30",
    });
  });

  it("does not pass the end date when catching up", () => {
    const plan = planRun(monthly({ endDate: "2026-02-28" }), "2026-06-01");
    expect(plan).toMatchObject({ kind: "run", periodDate: "2026-02-28", nextRunDate: null });
  });

  it("ends after the last counted invoice", () => {
    expect(planRun(monthly({ maxCount: 2, generatedCount: 1 }), "2026-02-28")).toMatchObject({
      kind: "run",
      nextRunDate: null,
    });
    expect(planRun(monthly({ maxCount: 2, generatedCount: 2 }), "2026-03-31")).toEqual({
      kind: "end",
    });
  });

  it("ends when the next date is past the end date", () => {
    expect(planRun(monthly({ nextIndex: 2, endDate: "2026-03-01" }), "2026-04-01")).toEqual({
      kind: "end",
    });
  });
});

describe("upcomingRunDates", () => {
  it("lists dates up to the schedule's end", () => {
    expect(upcomingRunDates(monthly({ maxCount: 2 }), 3)).toEqual(["2026-01-31", "2026-02-28"]);
    expect(upcomingRunDates(monthly({ endDate: "2026-03-30" }), 5)).toEqual([
      "2026-01-31",
      "2026-02-28",
    ]);
  });
});

describe("indexOnOrAfter", () => {
  it("finds the first occurrence on or after a date", () => {
    expect(indexOnOrAfter("2026-01-31", "monthly", "2026-03-01")).toBe(2);
    expect(indexOnOrAfter("2026-01-31", "monthly", "2026-01-31")).toBe(0);
  });
});

describe("fillPeriodPlaceholders", () => {
  it("fills month and year", () => {
    expect(fillPeriodPlaceholders("Retainer for {month} {Year}", "2026-12-01")).toBe(
      "Retainer for December 2026",
    );
  });
});
