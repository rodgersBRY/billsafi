import { describe, expect, it } from "vitest";
import {
  adminActivityQuerySchema,
  adminActivitySchema,
  adminAnalyticsSchema,
  adminOverviewSchema,
  adminRangeQuerySchema,
  adminRateSchema,
  adminTrendsSchema,
} from "./admin-analytics.js";
import { adminFunnelQuerySchema } from "./admin.js";
import { adminOverridesQuerySchema, adminPlanPaymentsQuerySchema } from "./admin-subscriptions.js";

describe("adminRangeQuerySchema", () => {
  it("defaults to 30 days, also for a blank value", () => {
    expect(adminRangeQuerySchema.parse({})).toEqual({ range: "30d" });
    expect(adminRangeQuerySchema.parse({ range: "" })).toEqual({ range: "30d" });
  });

  it("allows 7d, 30d, 90d and 12m only", () => {
    for (const range of ["7d", "30d", "90d", "12m"]) {
      expect(adminRangeQuerySchema.parse({ range })).toEqual({ range });
    }
    for (const range of ["1y", "30", "all", "7D"]) {
      expect(adminRangeQuerySchema.safeParse({ range }).success).toBe(false);
    }
  });
});

describe("adminActivityQuerySchema", () => {
  it("defaults to 20 and reads query strings", () => {
    expect(adminActivityQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(adminActivityQuerySchema.parse({ limit: "" })).toEqual({ limit: 20 });
    expect(adminActivityQuerySchema.parse({ limit: "50" })).toEqual({ limit: 50 });
  });

  it("rejects 0, more than 50, decimals and text", () => {
    for (const limit of ["0", "51", "2.5", "abc", "-1"]) {
      expect(adminActivityQuerySchema.safeParse({ limit }).success).toBe(false);
    }
  });
});

describe("directory filters used by the attention list", () => {
  it("reads stuck payments and overrides ending soon", () => {
    expect(adminPlanPaymentsQuerySchema.parse({ stuck: "true" }).stuck).toBe(true);
    expect(adminPlanPaymentsQuerySchema.parse({}).stuck).toBeUndefined();
    expect(adminOverridesQuerySchema.parse({ endingWithin: "7" }).endingWithin).toBe(7);
    expect(adminOverridesQuerySchema.safeParse({ endingWithin: "3" }).success).toBe(false);
  });

  it("lets the funnel cover a year for the 12 month range", () => {
    expect(adminFunnelQuerySchema.parse({ days: "365" })).toEqual({ days: 365 });
  });
});

const period = { start: "2031-02-16T21:00:00.000Z", end: "2031-03-18T09:00:00.000Z" };
const rate = { rate: 0.6, count: 3, base: 5 };
const pair = <T>(value: T) => ({ current: value, previous: value });

const overview = {
  range: "30d",
  period,
  previousPeriod: { start: "2031-01-17T21:00:00.000Z", end: period.start },
  totalAccounts: pair(20),
  signups: pair({ total: 8, google: 1, email: 7 }),
  activeAccounts: pair(5),
  payingAccounts: pair(3),
  complimentaryProAccounts: pair(2),
  mrrUsd: pair("12.00"),
  proChurn: pair(rate),
  invoicesReady: pair(9),
  collected: { kes: pair("1120.00"), usd: pair("4.00") },
  mpesa: pair({ succeeded: 2, failed: 1, successRate: 0.6667 }),
  activation: pair(rate),
  attention: {
    stuckPayments: 1,
    suspendedAccounts: 0,
    proEnding: 2,
    proLapsed: 3,
    freeLimitReached: 1,
    overridesEnding: 1,
  },
  definitions: Object.fromEntries(
    [
      "totalAccounts",
      "signups",
      "activeAccounts",
      "payingAccounts",
      "complimentaryProAccounts",
      "mrrUsd",
      "proChurn",
      "invoicesReady",
      "collected",
      "mpesa",
      "activation",
    ].map((key) => [key, `What ${key} counts.`]),
  ),
  generatedAt: period.end,
};

describe("adminRateSchema", () => {
  it("allows a null rate with a zero base", () => {
    expect(adminRateSchema.parse({ rate: null, count: 0, base: 0 })).toEqual({
      rate: null,
      count: 0,
      base: 0,
    });
  });

  it("rejects a rate above 1 and negative counts", () => {
    expect(adminRateSchema.safeParse({ rate: 1.2, count: 1, base: 1 }).success).toBe(false);
    expect(adminRateSchema.safeParse({ rate: 0, count: -1, base: 1 }).success).toBe(false);
  });
});

describe("adminOverviewSchema", () => {
  it("reads a full response", () => {
    expect(adminOverviewSchema.parse(overview)).toEqual(overview);
  });

  it("keeps money as 2dp strings and rejects numbers", () => {
    expect(adminOverviewSchema.safeParse({ ...overview, mrrUsd: pair(12) }).success).toBe(false);
    expect(adminOverviewSchema.safeParse({ ...overview, mrrUsd: pair("12") }).success).toBe(false);
  });

  it("needs both the current and the previous value", () => {
    expect(
      adminOverviewSchema.safeParse({ ...overview, activeAccounts: { current: 5 } }).success,
    ).toBe(false);
  });

  it("rejects an unknown range", () => {
    expect(adminOverviewSchema.safeParse({ ...overview, range: "1y" }).success).toBe(false);
  });
});

describe("adminTrendsSchema", () => {
  const point = {
    bucketStart: "2031-03-17",
    signups: 1,
    accountsTotal: 20,
    firstInvoices: 1,
    invoicesReady: 1,
    kesCollected: "100.00",
    usdCollected: "0.00",
  };
  const trends = {
    range: "30d",
    bucketSize: "day",
    period,
    points: [point],
    subscriptionMix: {
      total: 20,
      free: 12,
      proPaid: 1,
      proComplimentary: 2,
      proEnding: 2,
      lapsed: 3,
    },
    generatedAt: period.end,
  };

  it("reads a response and rejects a bad bucket size or money", () => {
    expect(adminTrendsSchema.parse(trends)).toEqual(trends);
    expect(adminTrendsSchema.safeParse({ ...trends, bucketSize: "hour" }).success).toBe(false);
    expect(
      adminTrendsSchema.safeParse({ ...trends, points: [{ ...point, kesCollected: "100" }] })
        .success,
    ).toBe(false);
  });
});

describe("adminActivitySchema", () => {
  const item = {
    id: "pro_payment:1",
    kind: "pro_payment",
    at: "2031-03-17T11:00:00.000Z",
    account: { id: "a", name: "Wanjiku" },
    summary: "Pro payment of KES 500.00 by M-Pesa",
    admin: null,
  };

  it("reads items with or without an admin or account", () => {
    const body = {
      items: [item, { ...item, id: "x", account: null, admin: { id: "b", name: "Owner" } }],
      generatedAt: period.end,
    };
    expect(adminActivitySchema.parse(body)).toEqual(body);
  });

  it("rejects an unknown kind", () => {
    expect(
      adminActivitySchema.safeParse({ items: [{ ...item, kind: "page_view" }], generatedAt: "" })
        .success,
    ).toBe(false);
  });
});

describe("adminAnalyticsSchema", () => {
  const analytics = {
    range: "90d",
    bucketSize: "week",
    period,
    invoiceVolume: {
      points: [{ bucketStart: "2031-03-17", created: 2, ready: 1 }],
      accountsWithReady: 1,
      medianReadyPerAccount: 1,
    },
    timeToFirstInvoice: {
      signups: 8,
      reached: 5,
      medianHours: 3,
      p75Hours: 25,
      activation: rate,
    },
    featureAdoption: {
      base: 9,
      items: [{ key: "logo", count: 1, base: 9, share: 0.1111 }],
    },
    planLimit: [{ month: "2031-03", reached: 1, boughtWithin14Days: 0 }],
    topAccounts: [{ accountId: "a", name: "Wanjiku", email: "w@example.com", readyInvoices: 3 }],
    definitions: {
      invoiceVolume: "x",
      timeToFirstInvoice: "x",
      featureAdoption: "x",
      planLimit: "x",
      topAccounts: "x",
    },
    generatedAt: period.end,
  };

  it("reads a full response, nulls included", () => {
    expect(adminAnalyticsSchema.parse(analytics)).toEqual(analytics);
    const empty = {
      ...analytics,
      invoiceVolume: { points: [], accountsWithReady: 0, medianReadyPerAccount: null },
      timeToFirstInvoice: {
        signups: 0,
        reached: 0,
        medianHours: null,
        p75Hours: null,
        activation: { rate: null, count: 0, base: 0 },
      },
      featureAdoption: { base: 0, items: [{ key: "logo", count: 0, base: 0, share: null }] },
    };
    expect(adminAnalyticsSchema.parse(empty)).toEqual(empty);
  });

  it("rejects an unknown feature and a bad month", () => {
    expect(
      adminAnalyticsSchema.safeParse({
        ...analytics,
        featureAdoption: { base: 1, items: [{ key: "dark_mode", count: 1, base: 1, share: 1 }] },
      }).success,
    ).toBe(false);
    expect(
      adminAnalyticsSchema.safeParse({
        ...analytics,
        planLimit: [{ month: "March", reached: 0, boughtWithin14Days: 0 }],
      }).success,
    ).toBe(false);
  });
});
