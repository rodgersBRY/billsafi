import { type QuoteStatus, quoteStatuses } from "@billsafi/domain";
import { z } from "zod";
import { optionalText } from "./fields.js";
import {
  documentNumberSchema,
  type InvoiceBusinessDetails,
  type InvoiceClientDetails,
  type InvoiceItem,
  isoDate,
  pricingFields,
} from "./invoices.js";

export { type QuoteStatus, quoteStatuses };

export const QUOTE_LIMITS = {
  signerNameMin: 2,
  signerNameMax: 120,
  declineReasonLength: 500,
} as const;

export const quoteStatusLabels: Record<QuoteStatus | "expired", string> = {
  draft: "Draft",
  sent: "Sent",
  expired: "Expired",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
  converted: "Converted",
};

/** Draft create and save. Send checks the rest (items, active client, validity). */
export const saveQuoteSchema = z
  .object({
    clientId: z.uuid("Choose a client"),
    quoteNumber: documentNumberSchema,
    issueDate: isoDate,
    validUntil: isoDate,
    ...pricingFields,
  })
  .refine((quote) => quote.validUntil >= quote.issueDate, {
    path: ["validUntil"],
    message: "Valid until can't be before the issue date",
  });
export type SaveQuoteInput = z.input<typeof saveQuoteSchema>;
export type SaveQuote = z.output<typeof saveQuoteSchema>;

export const acceptQuoteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(QUOTE_LIMITS.signerNameMin, "Type your full name")
    .max(QUOTE_LIMITS.signerNameMax, `Use ${QUOTE_LIMITS.signerNameMax} characters or fewer`),
  agreed: z.literal(true, { error: "Tick the box to accept" }),
});
export type AcceptQuote = z.output<typeof acceptQuoteSchema>;

export const declineQuoteSchema = z.object({
  reason: optionalText(QUOTE_LIMITS.declineReasonLength),
});
export type DeclineQuote = z.output<typeof declineQuoteSchema>;

export const convertQuoteSchema = z.object({
  confirmUnaccepted: z.boolean().optional().default(false),
});
export type ConvertQuote = z.output<typeof convertQuoteSchema>;

export const quoteListStatuses = [...quoteStatuses, "expired"] as const;

export interface QuoteSummary {
  id: string;
  status: QuoteStatus;
  /** Sent and past its valid-until day in Nairobi. */
  expired: boolean;
  quoteNumber: string | null;
  clientName: string;
  issueDate: string;
  validUntil: string;
  currency: string;
  total: string;
  updatedAt: string;
}

export interface QuoteResponse {
  decision: "accepted" | "declined";
  signerName: string | null;
  reason: string | null;
  version: number;
  createdAt: string;
}

export interface Quote extends QuoteSummary {
  clientId: string;
  /** Saved snapshot once sent; the client's current details while Draft. */
  client: InvoiceClientDetails;
  business: InvoiceBusinessDetails;
  items: InvoiceItem[];
  discount: { type: "fixed" | "percentage"; value: string } | null;
  taxRate: string | null;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  notes: string | null;
  /** Null while Draft. */
  version: number | null;
  versions: { version: number; createdAt: string }[];
  /** The latest client response, if any. */
  response: QuoteResponse | null;
  sentAt: string | null;
  withdrawnAt: string | null;
  convertedInvoiceId: string | null;
}

/** A frozen copy of what the client could see at one version. */
export interface QuoteVersionContent {
  quoteNumber: string;
  issueDate: string;
  validUntil: string;
  currency: string;
  client: InvoiceClientDetails;
  business: InvoiceBusinessDetails;
  items: Omit<InvoiceItem, "id">[];
  discount: { type: "fixed" | "percentage"; value: string } | null;
  taxRate: string | null;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  notes: string | null;
}

export interface QuoteVersion {
  version: number;
  createdAt: string;
  content: QuoteVersionContent;
}

/** Returned once, when a link is created. Only a hash is stored. */
export interface CreatedQuoteLink {
  id: string;
  token: string;
  createdAt: string;
}

export interface QuoteLinkStatus {
  id: string;
  createdAt: string;
}

export interface SentQuote {
  quote: Quote;
  /** A new link when this send created one; null when the existing link stays in use. */
  link: CreatedQuoteLink | null;
}

/** What the client sees on /q/[token]. Converted shows as Accepted. */
export interface PublicQuote {
  quoteNumber: string;
  status: "sent" | "accepted" | "declined";
  expired: boolean;
  issueDate: string;
  validUntil: string;
  currency: string;
  business: Omit<InvoiceBusinessDetails, "logoKey">;
  client: Pick<InvoiceClientDetails, "name" | "companyName">;
  items: Omit<InvoiceItem, "id">[];
  discount: { type: "fixed" | "percentage"; value: string } | null;
  taxRate: string | null;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  notes: string | null;
  /** When the current version was saved, if it is not the first. */
  updatedAt: string | null;
  acceptedBy: { name: string; at: string } | null;
  hasLogo: boolean;
  showBranding: boolean;
}
