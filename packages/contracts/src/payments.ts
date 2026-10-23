import { z } from "zod";
import { optionalText, requiredText } from "./fields.js";
import { decimalString } from "./invoices.js";

export const receivedPaymentMethods = ["mpesa", "bank_transfer", "other"] as const;
export type ReceivedPaymentMethod = (typeof receivedPaymentMethods)[number];

export const receivedPaymentMethodLabels: Record<ReceivedPaymentMethod, string> = {
  mpesa: "M-Pesa",
  bank_transfer: "Bank transfer",
  other: "Other",
};

const paymentFields = {
  amount: decimalString("Amount", 0.01, 1_000_000_000_000),
  method: z.enum(receivedPaymentMethods),
  paymentDate: z.iso.date("Enter a valid date"),
  reference: optionalText(100),
};

/** Recording a payment received outside BillSafi (D002). */
export const recordPaymentSchema = z.object(paymentFields);
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;
export type RecordPayment = z.output<typeof recordPaymentSchema>;

const reason = requiredText("Reason", 500);

/** Correcting a mistaken payment record needs a reason (D043). */
export const correctPaymentSchema = z.object({ ...paymentFields, reason });
export type CorrectPaymentInput = z.input<typeof correctPaymentSchema>;
export type CorrectPayment = z.output<typeof correctPaymentSchema>;

export const reversePaymentSchema = z.object({ reason });
export type ReversePaymentInput = z.input<typeof reversePaymentSchema>;

export interface PaymentValues {
  amount: string;
  method: ReceivedPaymentMethod;
  paymentDate: string;
  reference: string | null;
}

export interface PaymentChange {
  kind: "correction" | "reversal";
  previousValues: PaymentValues;
  newValues: PaymentValues | null;
  reason: string;
  createdAt: string;
}

export interface Payment extends PaymentValues {
  id: string;
  reversedAt: string | null;
  recordedAt: string;
  changes: PaymentChange[];
}
