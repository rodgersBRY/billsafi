import { describe, expect, it } from "vitest";
import {
  addNairobiMonths,
  nairobiCalendarMonth,
  nairobiDayStart,
  nairobiWeekStart,
  proPeriodAt,
} from "./billing-period.js";

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

describe("addNairobiMonths", () => {
  it("keeps the anniversary day and time", () => {
    const anchor = new Date("2026-10-15T07:30:00Z");
    expect(addNairobiMonths(anchor, 1).toISOString()).toBe("2026-11-15T07:30:00.000Z");
    expect(addNairobiMonths(anchor, 3).toISOString()).toBe("2027-01-15T07:30:00.000Z");
  });

  it("clamps to the month's last day and returns to the anchor day later", () => {
    // 10:00 on 31 January in Nairobi.
    const anchor = new Date("2027-01-31T07:00:00Z");
    expect(addNairobiMonths(anchor, 1).toISOString()).toBe("2027-02-28T07:00:00.000Z");
    expect(addNairobiMonths(anchor, 2).toISOString()).toBe("2027-03-31T07:00:00.000Z");
  });

  it("uses the Nairobi date, not the UTC date", () => {
    // 01:00 on 31 March in Nairobi is still 30 March in UTC.
    const anchor = new Date("2027-03-30T22:00:00Z");
    expect(addNairobiMonths(anchor, 1).toISOString()).toBe("2027-04-29T22:00:00.000Z");
  });
});

describe("proPeriodAt", () => {
  const anchor = new Date("2026-10-15T07:30:00Z");

  it("finds the current period inside paid access", () => {
    const period = proPeriodAt(anchor, 3, new Date("2026-11-20T00:00:00Z"));
    expect(period).toEqual({
      index: 1,
      start: new Date("2026-11-15T07:30:00Z"),
      end: new Date("2026-12-15T07:30:00Z"),
    });
  });

  it("does not advance the period when months are prepaid", () => {
    expect(proPeriodAt(anchor, 2, new Date("2026-10-20T00:00:00Z"))?.index).toBe(0);
  });

  it("treats the period end as the start of the next one", () => {
    expect(proPeriodAt(anchor, 2, new Date("2026-11-15T07:30:00Z"))?.index).toBe(1);
  });

  it("returns null before the anchor and from the paid-through instant", () => {
    expect(proPeriodAt(anchor, 1, new Date("2026-10-15T07:29:59Z"))).toBeNull();
    expect(proPeriodAt(anchor, 1, new Date("2026-11-15T07:30:00Z"))).toBeNull();
    expect(proPeriodAt(anchor, 0, new Date("2026-10-20T00:00:00Z"))).toBeNull();
  });
});

describe("nairobiDayStart", () => {
  it("returns Nairobi midnight as UTC", () => {
    expect(nairobiDayStart(new Date("2026-10-24T10:00:00Z")).toISOString()).toBe(
      "2026-10-23T21:00:00.000Z",
    );
  });

  it("moves late UTC evenings to the next Nairobi day", () => {
    // 22:00 UTC on 23 October is 01:00 on 24 October in Nairobi.
    expect(nairobiDayStart(new Date("2026-10-23T22:00:00Z")).toISOString()).toBe(
      "2026-10-23T21:00:00.000Z",
    );
  });
});

describe("nairobiWeekStart", () => {
  it("starts the week on Monday in Nairobi", () => {
    // Saturday 24 October 2026; the week began Monday 19 October.
    expect(nairobiWeekStart(new Date("2026-10-24T10:00:00Z")).toISOString()).toBe(
      "2026-10-18T21:00:00.000Z",
    );
  });

  it("keeps Monday itself in its own week", () => {
    expect(nairobiWeekStart(new Date("2026-10-18T21:00:00Z")).toISOString()).toBe(
      "2026-10-18T21:00:00.000Z",
    );
  });

  it("puts Sunday in the week that began the Monday before", () => {
    // 20:59 UTC Sunday 18 October is still Sunday 23:59 in Nairobi.
    expect(nairobiWeekStart(new Date("2026-10-18T20:59:00Z")).toISOString()).toBe(
      "2026-10-11T21:00:00.000Z",
    );
  });

  it("uses the Nairobi weekday, not the UTC one", () => {
    // 22:00 UTC Sunday is 01:00 Monday in Nairobi.
    expect(nairobiWeekStart(new Date("2026-10-25T22:00:00Z")).toISOString()).toBe(
      "2026-10-25T21:00:00.000Z",
    );
  });
});
