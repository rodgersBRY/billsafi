import { z } from "zod";
import { mpesaPhone, phone, optionalText, requiredText } from "./fields.js";

export const businessProfileTypes = ["individual", "business"] as const;
export type BusinessProfileType = (typeof businessProfileTypes)[number];

export const createBusinessSchema = z.object({
  profileType: z.enum(businessProfileTypes),
  displayName: requiredText("Display name"),
  contactEmail: z.email("Enter a valid email address").trim().max(254),
  phone,
  address: optionalText(300),
  kraPin: optionalText(20).transform((value) => value?.toUpperCase() ?? null),
  defaultPaymentTermsDays: z.number().int().min(0).max(365).default(14),
});
export type CreateBusinessInput = z.input<typeof createBusinessSchema>;
export type CreateBusiness = z.output<typeof createBusinessSchema>;

export const updateBusinessSchema = createBusinessSchema.partial();
export type UpdateBusinessInput = z.input<typeof updateBusinessSchema>;

export interface Business {
  id: string;
  profileType: BusinessProfileType;
  displayName: string;
  contactEmail: string;
  phone: string;
  address: string | null;
  kraPin: string | null;
  logoKey: string | null;
  defaultCurrency: string;
  defaultPaymentTermsDays: number;
  createdAt: string;
  updatedAt: string;
}

export const paymentMethods = [
  "mpesa_personal",
  "mpesa_till",
  "mpesa_paybill",
  "bank_transfer",
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  mpesa_personal: "Personal M-Pesa number",
  mpesa_till: "M-Pesa Till",
  mpesa_paybill: "M-Pesa Paybill",
  bank_transfer: "Bank transfer",
};

const tillOrPaybillNumber = z
  .string()
  .trim()
  .regex(/^\d{5,10}$/, "Enter the 5 to 10 digit number");

/**
 * Mirrors the approved onboarding design: M-Pesa methods take a number,
 * bank transfer relies on written instructions.
 */
export const createPaymentInstructionSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("mpesa_personal"),
    accountNumber: mpesaPhone,
    instructions: optionalText(1000),
  }),
  z.object({
    method: z.literal("mpesa_till"),
    accountNumber: tillOrPaybillNumber,
    instructions: optionalText(1000),
  }),
  z.object({
    method: z.literal("mpesa_paybill"),
    accountNumber: tillOrPaybillNumber,
    instructions: optionalText(1000),
  }),
  z.object({
    method: z.literal("bank_transfer"),
    accountNumber: z
      .null()
      .optional()
      .transform(() => null),
    instructions: requiredText("Bank transfer instructions", 1000),
  }),
]);
export type CreatePaymentInstructionInput = z.input<typeof createPaymentInstructionSchema>;

export interface PaymentInstruction {
  id: string;
  method: PaymentMethod;
  accountNumber: string | null;
  instructions: string | null;
  createdAt: string;
  updatedAt: string;
}
