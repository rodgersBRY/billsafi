import { describe, expect, it } from "vitest";
import {
  acceptQuoteSchema,
  convertQuoteSchema,
  declineQuoteSchema,
  saveQuoteSchema,
} from "./quotes.js";

const base = {
  clientId: "01a143e6-3893-73c6-b4ce-24527eebbf2b",
  issueDate: "2026-11-05",
  validUntil: "2026-11-19",
  items: [{ description: "Logo design", quantity: "1", unitPrice: "15000" }],
};

describe("saveQuoteSchema", () => {
  it("accepts a draft and defaults pricing to off", () => {
    expect(saveQuoteSchema.parse(base)).toMatchObject({ discount: null, taxRate: null });
  });

  it("rejects valid-until before the issue date", () => {
    const result = saveQuoteSchema.safeParse({ ...base, validUntil: "2026-11-04" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["validUntil"]);
  });

  it("trims custom quote numbers and rejects odd characters", () => {
    expect(saveQuoteSchema.parse({ ...base, quoteNumber: "  Q/2026/1 " }).quoteNumber).toBe(
      "Q/2026/1",
    );
    expect(saveQuoteSchema.safeParse({ ...base, quoteNumber: 'Q"1' }).success).toBe(false);
  });
});

describe("acceptQuoteSchema", () => {
  it("needs a name of 2 to 120 characters and the agreement box", () => {
    expect(acceptQuoteSchema.parse({ name: "  Otieno Ouma ", agreed: true }).name).toBe(
      "Otieno Ouma",
    );
    expect(acceptQuoteSchema.safeParse({ name: "O", agreed: true }).success).toBe(false);
    expect(acceptQuoteSchema.safeParse({ name: "x".repeat(121), agreed: true }).success).toBe(
      false,
    );
    expect(acceptQuoteSchema.safeParse({ name: "Otieno", agreed: false }).success).toBe(false);
    expect(acceptQuoteSchema.safeParse({ name: "Otieno" }).success).toBe(false);
  });
});

describe("declineQuoteSchema", () => {
  it("takes an optional reason up to 500 characters", () => {
    expect(declineQuoteSchema.parse({}).reason).toBeUndefined();
    expect(declineQuoteSchema.parse({ reason: "  " }).reason).toBeNull();
    expect(declineQuoteSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
  });
});

describe("convertQuoteSchema", () => {
  it("defaults confirmUnaccepted to false", () => {
    expect(convertQuoteSchema.parse({}).confirmUnaccepted).toBe(false);
  });
});
