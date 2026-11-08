import { recurringFrequencies, type RecurringFrequency } from "@billsafi/domain";
import { z } from "zod";
import { optionalText } from "./fields.js";
import { INVOICE_LIMITS, isoDate, pricingFields, type InvoiceItem } from "./invoices.js";

export { recurringFrequencies, type RecurringFrequency };

export const recurringFrequencyLabels: Record<RecurringFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Every 3 months",
  yearly: "Yearly",
};

/** Whether each run makes a Draft to review or a Ready invoice (D082). */
export const recurringModes = ["draft", "ready"] as const;
export type RecurringMode = (typeof recurringModes)[number];

export const recurringStatuses = ["active", "paused", "ended"] as const;
export type RecurringStatus = (typeof recurringStatuses)[number];

/** Why a schedule is paused: by the user, because Pro ended, or because its client was archived. */
export const recurringPauseReasons = ["user", "pro_ended", "client_archived"] as const;
export type RecurringPauseReason = (typeof recurringPauseReasons)[number];

export const RECURRING_LIMITS = { maxCount: 120 } as const;

export const saveRecurringInvoiceSchema = z
  .object({
    clientId: z.uuid("Choose a client"),
    frequency: z.enum(recurringFrequencies, "Choose how often"),
    mode: z.enum(recurringModes, "Choose Draft or Ready"),
    startDate: isoDate,
    endDate: isoDate.nullable().default(null),
    maxCount: z
      .number("Enter a whole number")
      .int("Enter a whole number")
      .min(1, "Make at least 1 invoice")
      .max(RECURRING_LIMITS.maxCount, `Use ${RECURRING_LIMITS.maxCount} or fewer`)
      .nullable()
      .default(null),
    paymentTermsDays: z
      .number("Enter a number of days")
      .int("Enter a whole number of days")
      .min(0, "Use 0 to 365 days")
      .max(365, "Use 0 to 365 days"),
    ...pricingFields,
    items: pricingFields.items.min(1, "Add at least one line item"),
    paymentInstructions: optionalText(INVOICE_LIMITS.paymentInstructionsLength),
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "End date can't be before the start date",
  })
  .refine((value) => value.endDate === null || value.maxCount === null, {
    path: ["maxCount"],
    message: "Pick an end date or a number of invoices, not both",
  });
export type SaveRecurringInvoiceInput = z.input<typeof saveRecurringInvoiceSchema>;
export type SaveRecurringInvoice = z.output<typeof saveRecurringInvoiceSchema>;

export interface RecurringInvoiceSummary {
  id: string;
  clientId: string;
  clientName: string;
  status: RecurringStatus;
  pausedReason: RecurringPauseReason | null;
  frequency: RecurringFrequency;
  mode: RecurringMode;
  currency: string;
  total: string;
  /** Null once the schedule has ended. */
  nextRunDate: string | null;
  generatedCount: number;
  updatedAt: string;
}

export interface RecurringInvoice extends RecurringInvoiceSummary {
  startDate: string;
  endDate: string | null;
  maxCount: number | null;
  paymentTermsDays: number;
  items: InvoiceItem[];
  discount: { type: "fixed" | "percentage"; value: string } | null;
  taxRate: string | null;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  notes: string | null;
  paymentInstructions: string | null;
  lastRunAt: string | null;
  /** The next few run dates, for the preview line. */
  upcoming: string[];
  /** Invoices this schedule made, newest first. */
  invoices: {
    id: string;
    status: string;
    invoiceNumber: string | null;
    periodDate: string;
    total: string;
  }[];
  createdAt: string;
}
