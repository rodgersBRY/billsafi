import { nairobiDate } from "@billsafi/domain";
import { describe, expect, it } from "vitest";
import { adminRecordPaymentSchema, idempotencyKeySchema } from "./admin-subscriptions.js";

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
