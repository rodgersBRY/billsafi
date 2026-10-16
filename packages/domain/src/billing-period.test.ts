import { describe, expect, it } from "vitest";
import { nairobiCalendarMonth } from "./billing-period.js";

describe("nairobiCalendarMonth", () => {
  it("returns the month boundaries at Nairobi midnight", () => {
    const period = nairobiCalendarMonth(new Date("2026-10-16T08:00:00Z"));
    expect(period.start.toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-10-31T21:00:00.000Z");
  });

  it("puts late UTC evenings on the last day into the next Nairobi month", () => {
    // 22:30 UTC on 31 October is 01:30 on 1 November in Nairobi.
    const period = nairobiCalendarMonth(new Date("2026-10-31T22:30:00Z"));
    expect(period.start.toISOString()).toBe("2026-10-31T21:00:00.000Z");
  });

  it("handles the December to January rollover", () => {
    const period = nairobiCalendarMonth(new Date("2026-12-15T12:00:00Z"));
    expect(period.end.toISOString()).toBe("2026-12-31T21:00:00.000Z");
  });
});
