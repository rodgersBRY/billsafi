import { describe, expect, it } from "vitest";
import {
  nextReengagementEmail,
  REENGAGEMENT_COOLDOWN_DAYS,
  type ReengagementFacts,
  reengagementSegment,
} from "./reengagement.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-03T09:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);

const facts = (overrides: Partial<ReengagementFacts> = {}): ReengagementFacts => ({
  stage: "registered",
  quietSince: daysAgo(4),
  sent: [],
  ...overrides,
});

describe("reengagementSegment", () => {
  it("maps lifecycle stages to segments", () => {
    expect(reengagementSegment("registered")).toBe("no_business");
    expect(reengagementSegment("onboarding")).toBe("no_invoice");
    expect(reengagementSegment("inactive")).toBe("lapsed");
    expect(reengagementSegment("activated")).toBeNull();
    expect(reengagementSegment("subscribed")).toBeNull();
  });
});

describe("nextReengagementEmail", () => {
  it("waits until the account has been quiet long enough", () => {
    expect(nextReengagementEmail(facts({ quietSince: daysAgo(2) }), now)).toBeNull();
    expect(nextReengagementEmail(facts(), now)).toEqual({ segment: "no_business", step: 1 });
  });

  it("leaves active and Pro accounts alone", () => {
    expect(nextReengagementEmail(facts({ stage: "activated" }), now)).toBeNull();
    expect(nextReengagementEmail(facts({ stage: "subscribed" }), now)).toBeNull();
  });

  it("starts lapsed accounts after 30 quiet days", () => {
    expect(
      nextReengagementEmail(facts({ stage: "inactive", quietSince: daysAgo(29) }), now),
    ).toBeNull();
    expect(
      nextReengagementEmail(facts({ stage: "inactive", quietSince: daysAgo(31) }), now),
    ).toEqual({
      segment: "lapsed",
      step: 1,
    });
  });

  it("moves to the next step after the gap and the quiet threshold", () => {
    const sent = [{ step: 1 as const, sentAt: daysAgo(8) }];
    expect(nextReengagementEmail(facts({ quietSince: daysAgo(11), sent }), now)).toEqual({
      segment: "no_business",
      step: 2,
    });
    // Not quiet long enough for step 2 yet.
    expect(nextReengagementEmail(facts({ quietSince: daysAgo(9), sent }), now)).toBeNull();
  });

  it("spaces a backlog out by at least a week", () => {
    const sent = [{ step: 1 as const, sentAt: daysAgo(3) }];
    expect(nextReengagementEmail(facts({ quietSince: daysAgo(60), sent }), now)).toBeNull();
  });

  it("stops after three emails", () => {
    const sent = [
      { step: 1 as const, sentAt: daysAgo(40) },
      { step: 2 as const, sentAt: daysAgo(30) },
      { step: 3 as const, sentAt: daysAgo(20) },
    ];
    expect(nextReengagementEmail(facts({ quietSince: daysAgo(50), sent }), now)).toBeNull();
  });

  it("restarts after the account comes back, but only after the cooldown", () => {
    const old = [{ step: 1 as const, sentAt: daysAgo(30) }];
    // Came back 20 days ago and went quiet again: earlier email is too recent.
    expect(nextReengagementEmail(facts({ quietSince: daysAgo(20), sent: old }), now)).toBeNull();
    const longAgo = [{ step: 3 as const, sentAt: daysAgo(REENGAGEMENT_COOLDOWN_DAYS + 5) }];
    expect(nextReengagementEmail(facts({ quietSince: daysAgo(20), sent: longAgo }), now)).toEqual({
      segment: "no_business",
      step: 1,
    });
  });

  it("skips addresses quiet for over a year", () => {
    expect(nextReengagementEmail(facts({ quietSince: daysAgo(400) }), now)).toBeNull();
  });
});
