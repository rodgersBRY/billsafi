import { Injectable } from "@nestjs/common";
import { renderToBuffer } from "@react-pdf/renderer";
import type { PublicInvoice } from "@tallynest/contracts";
import { InvoicePdf } from "./invoice-pdf.js";

/** PDFs are snapshots at generation time and aren't stored (D026, D042). */
@Injectable()
export class PdfService {
  render(invoice: PublicInvoice): Promise<Buffer> {
    return renderToBuffer(<InvoicePdf invoice={invoice} />);
  }

  fileName(invoice: PublicInvoice): string {
    return `${invoice.invoiceNumber}.pdf`;
  }
}
