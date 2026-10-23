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

  it("accepts a phone number from any country", () => {
    const result = createBusinessSchema.safeParse({ ...valid, phone: "+44 20 7946 0958" });
    expect(result.data?.phone).toBe("+442079460958");
  });

  it("rejects a number without a country code with a helpful message", () => {
    const result = createBusinessSchema.safeParse({ ...valid, phone: "020 7946 0958" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/country code/);
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

  it("keeps M-Pesa numbers to Kenyan mobiles", () => {
    const result = createPaymentInstructionSchema.safeParse({
      method: "mpesa_personal",
      accountNumber: "+44 20 7946 0958",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/M-Pesa number/);
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
