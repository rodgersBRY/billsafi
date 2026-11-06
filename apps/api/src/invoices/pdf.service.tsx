import { Injectable } from "@nestjs/common";
import { renderToBuffer } from "@react-pdf/renderer";
import type { PublicInvoice, PublicQuote } from "@billsafi/contracts";
import type { InvoiceLogo } from "./branding.service.js";
import { QuotePdf } from "../quotes/quote-pdf.js";
import { InvoicePdf } from "./invoice-pdf.js";

/** PDFs are snapshots at generation time and aren't stored (D026, D042). */
@Injectable()
export class PdfService {
  render(invoice: PublicInvoice, logo: InvoiceLogo | null): Promise<Buffer> {
    return renderToBuffer(<InvoicePdf invoice={invoice} logo={logo} />);
  }

  fileName(invoice: PublicInvoice): string {
    return `${invoice.invoiceNumber.replace(/[^A-Za-z0-9_.-]/g, "_")}.pdf`;
  }

  renderQuote(quote: PublicQuote, logo: InvoiceLogo | null): Promise<Buffer> {
    return renderToBuffer(<QuotePdf quote={quote} logo={logo} />);
  }

  quoteFileName(quote: PublicQuote): string {
    return `${quote.quoteNumber.replace(/[^A-Za-z0-9_.-]/g, "_")}.pdf`;
  }
}
