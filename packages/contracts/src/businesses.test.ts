import { describe, expect, it } from "vitest";
import { createBusinessSchema, createPaymentInstructionSchema } from "./businesses.js";

const valid = {
  profileType: "individual",
  displayName: "Wanjiku Designs",
  contactEmail: "hello@wanjiku.co.ke",
  phone: "0712 345 678",
} as const;

describe("createBusinessSchema", () => {
  it("normalizes phone, defaults terms and clears blank optional fields", () => {
    expect(createBusinessSchema.parse({ ...valid, address: "  ", kraPin: "a123456789z" })).toEqual({
      ...valid,
      phone: "+254712345678",
      address: null,
      kraPin: "A123456789Z",
      defaultPaymentTermsDays: 14,
    });
  });

  it("rejects a foreign phone number with a helpful message", () => {
    const result = createBusinessSchema.safeParse({ ...valid, phone: "+255712345678" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/Kenyan mobile number/);
  });

  it("requires a display name", () => {
    expect(createBusinessSchema.safeParse({ ...valid, displayName: "  " }).success).toBe(false);
  });
});

describe("createPaymentInstructionSchema", () => {
  it("normalizes a personal M-Pesa number", () => {
    expect(
      createPaymentInstructionSchema.parse({
        method: "mpesa_personal",
        accountNumber: "0712345678",
      }),
    ).toMatchObject({ accountNumber: "+254712345678" });
  });

  it("requires instructions for bank transfer and drops any number", () => {
    expect(createPaymentInstructionSchema.safeParse({ method: "bank_transfer" }).success).toBe(
      false,
    );
    expect(
      createPaymentInstructionSchema.parse({
        method: "bank_transfer",
        instructions: "Equity Bank, account 0123456789",
      }),
    ).toMatchObject({ accountNumber: null });
  });

  it("validates Till and Paybill numbers", () => {
    expect(
      createPaymentInstructionSchema.safeParse({ method: "mpesa_till", accountNumber: "12a45" })
        .success,
    ).toBe(false);
    expect(
      createPaymentInstructionSchema.parse({ method: "mpesa_paybill", accountNumber: " 247247 " }),
    ).toMatchObject({ accountNumber: "247247" });
  });
});
