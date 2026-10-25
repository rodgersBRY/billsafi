import { nairobiDate } from "@billsafi/domain";
import { describe, expect, it } from "vitest";
import {
  adminGrantSchema,
  adminGrantsQuerySchema,
  adminOverrideSchema,
  adminOverridesQuerySchema,
  adminPlanPaymentsQuerySchema,
  adminSubscriptionsQuerySchema,
  adminRecordPaymentSchema,
  idempotencyKeySchema,
} from "./admin-subscriptions.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const reason = "Paid by bank transfer";

describe("adminRecordPaymentSchema", () => {
  const pro = {
    purpose: "pro_month",
    months: 2,
    amount: "8",
    currency: "USD",
    method: "bank_transfer",
    reference: "  FT2629  ",
    paidAt: "2026-10-01",
    reason,
  };

  it("reads a Pro payment, trimming text and fixing the amount to 2 places", () => {
    expect(adminRecordPaymentSchema.parse(pro)).toEqual({
      ...pro,
      amount: "8.00",
      reference: "FT2629",
    });
  });

  it("reads a credits payment with packs and an optional note", () => {
    const parsed = adminRecordPaymentSchema.parse({
      ...pro,
      purpose: "invoice_credits",
      months: undefined,
      packs: 10,
      note: "  Paid at the office  ",
    });
    expect(parsed).toMatchObject({
      purpose: "invoice_credits",
      packs: 10,
      note: "Paid at the office",
    });
    expect(adminRecordPaymentSchema.parse({ ...pro, note: "" }).note).toBeUndefined();
    expect(adminRecordPaymentSchema.parse({ ...pro, note: null }).note).toBeUndefined();
  });

  it.each([
    { months: 0 },
    { months: 13 },
    { months: 1.5 },
    { purpose: "invoice_credits", packs: 11 },
    { purpose: "invoice_credits", packs: 0 },
    { purpose: "invoice_credits" },
    { purpose: "gift" },
    { amount: "0" },
    { amount: "0.00" },
    { amount: "-5" },
    { amount: "1.234" },
    { amount: "1e3" },
    { amount: 12 },
    { currency: "EUR" },
    { method: "cheque" },
    { reference: "" },
    { reference: "x".repeat(101) },
    { paidAt: "2026-13-01" },
    { paidAt: "2026-10-01T10:00:00Z" },
    { paidAt: nairobiDate(new Date(Date.now() + 2 * DAY_MS)) },
    { note: "n".repeat(501) },
    { reason: "abc" },
  ])("rejects %o", (change) => {
    expect(adminRecordPaymentSchema.safeParse({ ...pro, ...change }).success).toBe(false);
  });

  it("accepts today's Nairobi date", () => {
    expect(
      adminRecordPaymentSchema.safeParse({ ...pro, paidAt: nairobiDate(new Date()) }).success,
    ).toBe(true);
  });
});

describe("idempotencyKeySchema", () => {
  it("trims and limits the key to 100 characters", () => {
    expect(idempotencyKeySchema.parse("  abc  ")).toBe("abc");
    expect(idempotencyKeySchema.safeParse("k".repeat(100)).success).toBe(true);
    expect(idempotencyKeySchema.safeParse("k".repeat(101)).success).toBe(false);
    expect(idempotencyKeySchema.safeParse("   ").success).toBe(false);
  });
});

describe("adminGrantSchema", () => {
  it("reads Pro months up to 12 and credits up to 500", () => {
    expect(adminGrantSchema.parse({ kind: "pro_months", quantity: 12, reason })).toEqual({
      kind: "pro_months",
      quantity: 12,
      reason,
    });
    expect(
      adminGrantSchema.parse({ kind: "invoice_credits", quantity: 500, reason }).quantity,
    ).toBe(500);
  });

  it.each([
    { kind: "pro_months", quantity: 0 },
    { kind: "pro_months", quantity: 13 },
    { kind: "invoice_credits", quantity: 501 },
    { kind: "invoice_credits", quantity: "5" },
    { kind: "invoice_credits", quantity: 2.5 },
    { kind: "trial", quantity: 1 },
  ])("rejects %o", (body) => {
    expect(adminGrantSchema.safeParse({ ...body, reason }).success).toBe(false);
  });

  it("needs a reason", () => {
    expect(adminGrantSchema.safeParse({ kind: "pro_months", quantity: 1 }).success).toBe(false);
  });
});

describe("adminOverrideSchema", () => {
  const inDays = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();
  const base = { extraInvoices: 20, expiresAt: inDays(30), reason };

  it("starts now by default and accepts an expiry up to 366 days away", () => {
    expect(adminOverrideSchema.parse(base)).toEqual(base);
    expect(adminOverrideSchema.parse({ ...base, startsAt: "" }).startsAt).toBeUndefined();
    expect(adminOverrideSchema.safeParse({ ...base, expiresAt: inDays(365.9) }).success).toBe(true);
    expect(
      adminOverrideSchema.safeParse({ ...base, startsAt: inDays(1), expiresAt: inDays(2) }).success,
    ).toBe(true);
    // A start a moment ago is fine: clocks differ a little.
    expect(
      adminOverrideSchema.safeParse({
        ...base,
        startsAt: new Date(Date.now() - 60_000).toISOString(),
      }).success,
    ).toBe(true);
  });

  it.each([
    [{ extraInvoices: 0 }, "extraInvoices"],
    [{ extraInvoices: 1001 }, "extraInvoices"],
    [{ extraInvoices: 1.5 }, "extraInvoices"],
    [{ expiresAt: undefined }, "expiresAt"],
    [{ expiresAt: "2026-12-01" }, "expiresAt"],
    [{ expiresAt: inDays(367) }, "expiresAt"],
    [{ expiresAt: inDays(-1) }, "expiresAt"],
    [{ startsAt: inDays(3), expiresAt: inDays(2) }, "expiresAt"],
    [{ startsAt: inDays(-1) }, "startsAt"],
  ])("rejects %o at %s", (change, path) => {
    const result = adminOverrideSchema.safeParse({ ...base, ...change });
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((issue) => issue.path.join("."))).toContain(path);
  });
});

describe("admin subscription list queries", () => {
  it("defaults the subscriptions directory and reads its filters", () => {
    expect(adminSubscriptionsQuerySchema.parse({})).toEqual({
      page: 1,
      sort: "registered",
      dir: "desc",
    });
    expect(
      adminSubscriptionsQuerySchema.parse({
        renewalWithin: "7",
        lapsedWithin: "30",
        hasOverride: "false",
        subscriptionStatus: "pro_ending",
        sort: "proUntil",
        dir: "asc",
      }),
    ).toMatchObject({
      renewalWithin: 7,
      lapsedWithin: 30,
      hasOverride: false,
      subscriptionStatus: "pro_ending",
      sort: "proUntil",
      dir: "asc",
    });
    expect(adminSubscriptionsQuerySchema.parse({ hasOverride: "" }).hasOverride).toBeUndefined();
  });

  it.each([{ renewalWithin: "14" }, { lapsedWithin: "7" }, { hasOverride: "yes" }, { sort: "x" }])(
    "rejects %o in the directory",
    (query) => {
      expect(adminSubscriptionsQuerySchema.safeParse(query).success).toBe(false);
    },
  );

  it("filters payments by provider, status, method and Nairobi days", () => {
    expect(
      adminPlanPaymentsQuerySchema.parse({
        provider: "manual",
        status: "succeeded",
        method: "cash",
        from: "2026-10-01",
        to: "2026-10-31",
      }),
    ).toMatchObject({ provider: "manual", method: "cash", from: "2026-10-01" });
    expect(adminPlanPaymentsQuerySchema.safeParse({ provider: "paypal" }).success).toBe(false);
    expect(
      adminPlanPaymentsQuerySchema.safeParse({ from: "2026-10-10", to: "2026-10-01" }).success,
    ).toBe(false);
  });

  it("filters grants by kind and overrides by state", () => {
    expect(adminGrantsQuerySchema.parse({ kind: "pro_months" }).kind).toBe("pro_months");
    expect(adminGrantsQuerySchema.safeParse({ kind: "trial" }).success).toBe(false);
    expect(adminOverridesQuerySchema.parse({ state: "scheduled" }).state).toBe("scheduled");
    expect(adminOverridesQuerySchema.safeParse({ state: "paused" }).success).toBe(false);
  });
});
