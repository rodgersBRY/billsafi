import type {
  InvoiceBusinessDetails,
  InvoiceClientDetails,
  InvoiceItem,
  InvoiceStatus,
} from "./invoices.js";

/** Public links last 30 days (D049). */
export const PUBLIC_LINK_LIFETIME_DAYS = 30;

/** Returned once, when a link is created. Only a hash is stored, so it can't be shown again. */
export interface CreatedInvoiceLink {
  id: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

/** The current link, without its token. */
export interface InvoiceLinkStatus {
  id: string;
  expiresAt: string;
  createdAt: string;
}

/** What clients see without an account: the same details as the PDF (D049). */
export interface PublicInvoice {
  invoiceNumber: string;
  status: Exclude<InvoiceStatus, "draft" | "cancelled">;
  overdue: boolean;
  issueDate: string;
  dueDate: string;
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
  paymentsReceived: string;
  balanceDue: string;
  paymentInstructions: string | null;
  notes: string | null;
  /** The logo is served from the public link's /logo path. */
  hasLogo: boolean;
  /** "Created with Billsafi" shows for Free accounts only (D052). */
  showBranding: boolean;
}

export interface ShareMessageInput {
  clientName: string;
  invoiceNumber: string;
  businessName: string;
  balanceDue: string;
  dueDate: string;
  link: string;
}

/** Share copy adopted in D049. Amounts and dates arrive already formatted. */
export function whatsappMessage(input: ShareMessageInput): string {
  return `Hi ${input.clientName}, here is invoice ${input.invoiceNumber} from ${input.businessName} for KES ${input.balanceDue}, due ${input.dueDate}: ${input.link}`;
}

export function emailDraft(input: ShareMessageInput): { subject: string; body: string } {
  return {
    subject: `Invoice ${input.invoiceNumber} from ${input.businessName}`,
    body: `${whatsappMessage(input)}\n\nThe link works for ${PUBLIC_LINK_LIFETIME_DAYS} days. Thank you.`,
  };
}
