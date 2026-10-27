import { z } from "zod";
import { optionalText, requiredText } from "./fields.js";

/** Input limits adopted in D048. */
export const INVOICE_LIMITS = {
  maxItems: 100,
  descriptionLength: 500,
  minQuantity: 0.01,
  maxQuantity: 1_000_000,
  maxUnitPrice: 100_000_000,
  notesLength: 2000,
  paymentInstructionsLength: 1000,
} as const;

/** A non-negative decimal with at most two places, kept as a string to avoid float errors. */
export const decimalString = (label: string, min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .pipe(
      z
        .string()
        .min(1, `${label} is required`)
        .regex(/^\d+(\.\d{1,2})?$/, `${label} must be a number with up to 2 decimal places`)
        .refine((value) => Number(value) >= min, `${label} must be at least ${min}`)
        .refine(
          (value) => Number(value) <= max,
          `${label} must be ${max.toLocaleString("en-KE")} or less`,
        ),
    );

const isoDate = z.iso.date("Enter a valid date");

export const invoiceItemSchema = z.object({
  description: requiredText("Description", INVOICE_LIMITS.descriptionLength),
  quantity: decimalString("Quantity", INVOICE_LIMITS.minQuantity, INVOICE_LIMITS.maxQuantity),
  unitPrice: decimalString("Unit price", 0, INVOICE_LIMITS.maxUnitPrice),
});
export type InvoiceItemInput = z.input<typeof invoiceItemSchema>;

export const discountSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("fixed"), value: decimalString("Discount", 0, 1_000_000_000_000) }),
  z.object({ type: z.literal("percentage"), value: decimalString("Discount", 0, 100) }),
]);

/** Every invoice field except the client, shared by saved drafts and the public generator. */
const invoiceDetailFields = {
  issueDate: isoDate,
  dueDate: isoDate,
  items: z
    .array(invoiceItemSchema)
    .max(INVOICE_LIMITS.maxItems, `Use ${INVOICE_LIMITS.maxItems} line items or fewer`),
  discount: discountSchema.nullable().default(null),
  taxRate: decimalString("Tax rate", 0, 100).nullable().default(null),
  paymentInstructions: optionalText(INVOICE_LIMITS.paymentInstructionsLength),
  notes: optionalText(INVOICE_LIMITS.notesLength),
};

const dueDateIsValid = (invoice: { issueDate: string; dueDate: string }) =>
  invoice.dueDate >= invoice.issueDate;
const dueDateIssue = {
  path: ["dueDate"],
  message: "Due date can't be before the issue date",
};

/** Draft create and update. Drafts may be incomplete; Mark as Ready checks the rest. */
export const saveInvoiceSchema = z
  .object({ clientId: z.uuid("Choose a client"), ...invoiceDetailFields })
  .refine(dueDateIsValid, dueDateIssue);
export type SaveInvoiceInput = z.input<typeof saveInvoiceSchema>;
export type SaveInvoice = z.output<typeof saveInvoiceSchema>;

/** Invoice details without a client, for the public generator (D056). */
export const invoiceDetailsSchema = z
  .object(invoiceDetailFields)
  .refine(dueDateIsValid, dueDateIssue);

export const invoiceStatuses = ["draft", "ready", "partially_paid", "paid", "cancelled"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  partially_paid: "Partially paid",
  paid: "Paid",
  cancelled: "Cancelled",
};

export interface InvoiceItem {
  id: string;
  position: number;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

export interface InvoiceClientDetails {
  name: string;
  phone: string;
  email: string | null;
  companyName: string | null;
  address: string | null;
  kraPin: string | null;
}

export interface InvoiceBusinessDetails {
  displayName: string;
  contactEmail: string;
  phone: string;
  address: string | null;
  kraPin: string | null;
  logoKey: string | null;
}

export interface InvoiceSummary {
  id: string;
  status: InvoiceStatus;
  invoiceNumber: string | null;
  clientName: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  total: string;
  paymentsReceived: string;
  balanceDue: string;
  /** Ready or Partially paid and past the due date in Nairobi time (D049). */
  overdue: boolean;
  updatedAt: string;
}

export interface Invoice extends InvoiceSummary {
  clientId: string;
  /** Saved snapshot once Ready; the client's current details while Draft (D048). */
  client: InvoiceClientDetails;
  business: InvoiceBusinessDetails;
  items: InvoiceItem[];
  discount: { type: "fixed" | "percentage"; value: string } | null;
  taxRate: string | null;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  paymentInstructions: string | null;
  notes: string | null;
  readyAt: string | null;
  cancelledAt: string | null;
  /** True once any payment has been recorded; financial fields then stay locked (D043). */
  financialsLocked: boolean;
}

/** The account's allowance for the current Free month or Pro period (D044, D051). */
export interface AllowanceUsage {
  plan: "free" | "pro";
  /** The limit in force now: the plan's own limit plus `extraInvoices`. */
  limit: number;
  /** The plan's own limit, without overrides. */
  planLimit: number;
  /** Extra invoices from limit overrides BillSafi set, active now. */
  extraInvoices: number;
  /** When the soonest of those overrides ends; null without one. */
  extraEndsAt: string | null;
  /**
   * Can be above `limit` when a raised limit ended mid-period; `remaining` is then 0,
   * never negative.
   */
  used: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
  /** Purchased invoice credits left; used once the plan allowance runs out. */
  credits: number;
}
