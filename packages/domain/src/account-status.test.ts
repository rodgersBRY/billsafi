import { describe, expect, it } from "vitest";
import {
  accountStatus,
  hasProAccess,
  lifecycleStage,
  proEndsAt,
  subscriptionStatus,
} from "./account-status.js";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-25T09:00:00Z");
const daysFromNow = (days: number) => new Date(now.getTime() + days * DAY);

describe("accountStatus", () => {
  it("is suspended only when banned", () => {
    expect(accountStatus(true)).toBe("suspended");
    expect(accountStatus(false)).toBe("active");
  });
});

describe("proEndsAt", () => {
  it("is null without a paid month", () => {
    expect(proEndsAt({ anchorAt: null, paidMonths: 0 })).toBeNull();
    expect(proEndsAt({ anchorAt: now, paidMonths: 0 })).toBeNull();
  });

  it("adds anniversary months, clamping the day like the billing code", () => {
    const anchor = new Date("2026-01-30T21:30:00Z"); // 31 January 00:30 in Nairobi
    expect(proEndsAt({ anchorAt: anchor, paidMonths: 1 })!.toISOString()).toBe(
      "2026-02-27T21:30:00.000Z",
    );
  });
});

describe("subscriptionStatus", () => {
  it("is free with no Pro history", () => {
    expect(subscriptionStatus({ anchorAt: null, paidMonths: 0 }, now)).toBe("free");
  });

  it("is pro while more than 7 days remain", () => {
    // Anchored 20 days ago with one month paid: about 10 days left.
    expect(subscriptionStatus({ anchorAt: daysFromNow(-20), paidMonths: 1 }, now)).toBe("pro");
  });

  it("is pro_ending within the last 7 days, the 7-day mark included", () => {
    const anchor = new Date("2026-09-25T09:00:00Z"); // ends 2026-10-25T09:00Z
    expect(subscriptionStatus({ anchorAt: anchor, paidMonths: 1 }, daysFromNow(-7))).toBe(
      "pro_ending",
    );
    expect(subscriptionStatus({ anchorAt: anchor, paidMonths: 1 }, daysFromNow(-7.01))).toBe("pro");
    expect(subscriptionStatus({ anchorAt: anchor, paidMonths: 1 }, daysFromNow(-0.001))).toBe(
      "pro_ending",
    );
  });

  it("is lapsed from the moment paid access ends", () => {
    const anchor = new Date("2026-09-25T09:00:00Z");
    expect(subscriptionStatus({ anchorAt: anchor, paidMonths: 1 }, now)).toBe("lapsed");
    expect(subscriptionStatus({ anchorAt: daysFromNow(-90), paidMonths: 2 }, now)).toBe("lapsed");
  });

  it("agrees with hasProAccess", () => {
    const entitlement = { anchorAt: daysFromNow(-3), paidMonths: 1 };
    expect(hasProAccess(entitlement, now)).toBe(true);
    expect(hasProAccess({ anchorAt: daysFromNow(1), paidMonths: 1 }, now)).toBe(false);
    // An anchor in the future has neither started nor ended.
    expect(subscriptionStatus({ anchorAt: daysFromNow(1), paidMonths: 1 }, now)).toBe("free");
  });
});

describe("lifecycleStage", () => {
  const base = {
    businesses: 0,
    readyInvoices: 0,
    proAccess: false,
    lastMeaningfulActivityAt: null,
  };

  it("is registered without a business and onboarding with one", () => {
    expect(lifecycleStage(base, now)).toBe("registered");
    expect(lifecycleStage({ ...base, businesses: 2 }, now)).toBe("onboarding");
  });

  it("is activated after a Ready invoice with recent activity", () => {
    const facts = { ...base, businesses: 1, readyInvoices: 1, lastMeaningfulActivityAt: now };
    expect(lifecycleStage(facts, now)).toBe("activated");
    expect(lifecycleStage({ ...facts, lastMeaningfulActivityAt: daysFromNow(-30) }, now)).toBe(
      "activated",
    );
  });

  it("is inactive after 30 days without a meaningful action", () => {
    const facts = {
      ...base,
      businesses: 1,
      readyInvoices: 3,
      lastMeaningfulActivityAt: daysFromNow(-30.01),
    };
    expect(lifecycleStage(facts, now)).toBe("inactive");
  });

  it("puts subscribed above every other stage", () => {
    expect(lifecycleStage({ ...base, proAccess: true }, now)).toBe("subscribed");
    expect(
      lifecycleStage(
        { ...base, proAccess: true, readyInvoices: 1, lastMeaningfulActivityAt: daysFromNow(-60) },
        now,
      ),
    ).toBe("subscribed");
  });
});
