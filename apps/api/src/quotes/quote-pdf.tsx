import type { PublicQuote } from "@billsafi/contracts";
import type { InvoiceLogo } from "../invoices/branding.service.js";
import { amount, date, DocumentPdf } from "../invoices/document-pdf.js";

export function QuotePdf({ quote, logo }: { quote: PublicQuote; logo: InvoiceLogo | null }) {
  const dates = [`Issued ${date(quote.issueDate)}`, `Valid until ${date(quote.validUntil)}`];
  if (quote.acceptedBy) dates.push(`Accepted by ${quote.acceptedBy.name}`);
  return (
    <DocumentPdf
      logo={logo}
      view={{
        label: "QUOTE",
        number: quote.quoteNumber,
        business: quote.business,
        client: quote.client,
        dates,
        currency: quote.currency,
        items: quote.items,
        subtotal: quote.subtotal,
        discount: quote.discount,
        discountAmount: quote.discountAmount,
        taxRate: quote.taxRate,
        taxAmount: quote.taxAmount,
        summary: [
          { label: "Quote total", value: `${quote.currency} ${amount(quote.total)}`, strong: true },
        ],
        sections: quote.notes ? [{ label: "NOTES", text: quote.notes }] : [],
        showBranding: quote.showBranding,
      }}
    />
  );
}
