import type { PublicInvoice } from "@billsafi/contracts";
import type { InvoiceLogo } from "./branding.service.js";
import { amount, date, DocumentPdf } from "./document-pdf.js";

export function InvoicePdf({
  invoice,
  logo,
}: {
  invoice: PublicInvoice;
  logo: InvoiceLogo | null;
}) {
  const sections = [
    invoice.paymentInstructions && {
      label: "PAYMENT INSTRUCTIONS",
      text: invoice.paymentInstructions,
    },
    invoice.notes && { label: "NOTES", text: invoice.notes },
  ].filter((section): section is { label: string; text: string } => Boolean(section));
  return (
    <DocumentPdf
      logo={logo}
      view={{
        label: "INVOICE",
        number: invoice.invoiceNumber,
        business: invoice.business,
        client: invoice.client,
        dates: [`Issued ${date(invoice.issueDate)}`, `Due ${date(invoice.dueDate)}`],
        currency: invoice.currency,
        items: invoice.items,
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        discountAmount: invoice.discountAmount,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        summary: [
          { label: "Invoice total", value: amount(invoice.total), strong: true },
          { label: "Payments received", value: amount(invoice.paymentsReceived) },
          {
            label: "Balance due",
            value: `${invoice.currency} ${amount(invoice.balanceDue)}`,
            strong: true,
          },
        ],
        sections,
        showBranding: invoice.showBranding,
      }}
    />
  );
}
