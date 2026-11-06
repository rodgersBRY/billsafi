import type { PublicQuote, Quote, QuoteVersionContent } from "@billsafi/contracts";
import type { PreviewProps } from "@/components/invoices/invoice-preview";

type Source = Pick<
  Quote | PublicQuote | QuoteVersionContent,
  | "quoteNumber"
  | "issueDate"
  | "validUntil"
  | "items"
  | "discount"
  | "taxRate"
  | "subtotal"
  | "discountAmount"
  | "taxAmount"
  | "total"
  | "notes"
> & { client: { name: string; companyName: string | null } };

export function discountLabelOf(discount: Source["discount"]): string | null {
  if (!discount) return null;
  return discount.type === "percentage" ? `Discount (${Number(discount.value)}%)` : "Discount";
}

/** Stored quote values in the shape InvoicePreview takes, in quote mode. */
export function quotePreviewProps(
  quote: Source,
): Omit<PreviewProps, "business" | "logoSrc" | "showBranding" | "statusPill"> {
  return {
    kind: "quote",
    client: quote.client,
    invoiceNumber: quote.quoteNumber,
    issueDate: quote.issueDate,
    dueDate: quote.validUntil,
    items: quote.items,
    totals: {
      lineTotals: quote.items.map((item) => item.lineTotal),
      subtotal: quote.subtotal,
      discountAmount: quote.discountAmount,
      taxAmount: quote.taxAmount,
      total: quote.total,
    },
    discountLabel: discountLabelOf(quote.discount),
    taxRate: quote.taxRate ? String(Number(quote.taxRate)) : null,
    paymentInstructions: "",
    notes: quote.notes ?? "",
  };
}
