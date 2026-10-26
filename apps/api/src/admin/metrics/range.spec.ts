import { describe, expect, it } from "vitest";
import { planRange } from "./range.js";

// Tuesday 18 March 2031, 12:00 in Nairobi.
const now = new Date("2031-03-18T09:00:00Z");

describe("planRange", () => {
  it("cuts day ranges on Nairobi midnight, today included", () => {
    const plan = planRange("7d", now);
    expect(plan.bucket).toBe("day");
    expect(plan.bucketCount).toBe(7);
    expect(plan.start.toISOString()).toBe("2031-03-11T21:00:00.000Z");
    expect(plan.end).toEqual(now);
  });

  it("makes the previous period the same length, ending where the range starts", () => {
    for (const range of ["7d", "30d", "90d"] as const) {
      const plan = planRange(range, now);
      expect(plan.previousEnd).toEqual(plan.start);
      expect(plan.start.getTime() - plan.previousStart.getTime()).toBe(
        { "7d": 7, "30d": 30, "90d": 90 }[range] * 24 * 60 * 60 * 1000,
      );
    }
  });

  it("uses Monday weeks for 90 days, the first one starting at the range start", () => {
    const plan = planRange("90d", now);
    expect(plan.bucket).toBe("week");
    expect(plan.start.toISOString()).toBe("2030-12-18T21:00:00.000Z");
    // The Monday before the start is 16 December; 18 March falls in week 13.
    expect(plan.origin.toISOString()).toBe("2030-12-15T21:00:00.000Z");
    expect(plan.bucketCount).toBe(14);
  });

  it("uses twelve calendar months ending with the current one", () => {
    const plan = planRange("12m", now);
    expect(plan.bucket).toBe("month");
    expect(plan.bucketCount).toBe(12);
    expect(plan.start.toISOString()).toBe("2030-03-31T21:00:00.000Z");
    // Same elapsed length as the current period: 352.5 days before the start.
    expect(plan.previousStart.toISOString()).toBe("2029-04-14T09:00:00.000Z");
    expect(plan.start.getTime() - plan.previousStart.getTime()).toBe(
      now.getTime() - plan.start.getTime(),
    );
    expect(plan.previousEnd).toEqual(plan.start);
  });

  it("starts a 30 day range at midnight when the clock is a minute past it", () => {
    // 00:01 Nairobi on 18 March is 21:01Z on the 17th: today is still the 18th.
    const plan = planRange("30d", new Date("2031-03-17T21:01:00Z"));
    expect(plan.start.toISOString()).toBe("2031-02-16T21:00:00.000Z");
  });
});
