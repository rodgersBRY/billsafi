import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { type DatabaseConnection, eq, schema } from "@billsafi/db";
import { addCalendarDays, nairobiDate, quoteAllows, quoteDisplayStatus } from "@billsafi/domain";
import { DATABASE } from "../database/database.module.js";
import { InvoicesService } from "../invoices/invoices.service.js";
import { invalid, QuotesService } from "./quotes.service.js";

const { quotes, businesses } = schema;

@Injectable()
export class QuoteConversionService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly quotes: QuotesService,
    private readonly invoices: InvoicesService,
  ) {}

  /**
   * Copies an accepted quote into a new Draft invoice. No allowance is used until that
   * invoice is first marked Ready. Converting twice returns the same invoice with `created` false.
   */
  async convert(
    businessId: string,
    quoteId: string,
    confirmUnaccepted: boolean,
  ): Promise<{ invoiceId: string; created: boolean }> {
    return this.connection.db.transaction(async (tx) => {
      const current = await this.quotes.lockQuote(tx, businessId, quoteId);
      if (current.status === "converted" && current.convertedInvoiceId) {
        return { invoiceId: current.convertedInvoiceId, created: false };
      }
      const status = quoteDisplayStatus(current.status, current.validUntil);
      if (!quoteAllows("convert", status)) {
        throw new ConflictException("Only accepted or sent quotes can be converted");
      }
      if (status === "sent" && !confirmUnaccepted) {
        throw invalid(
          "confirmUnaccepted",
          "The client hasn't accepted this quote on the link. Confirm to convert anyway.",
        );
      }
      const quote = await this.quotes.load(tx, businessId, quoteId);
      const [business] = await tx
        .select({ terms: businesses.defaultPaymentTermsDays })
        .from(businesses)
        .where(eq(businesses.id, businessId));
      const today = nairobiDate(new Date());
      const invoice = await this.invoices.createDraft(
        businessId,
        {
          clientId: quote.clientId,
          invoiceNumber: null,
          issueDate: today,
          dueDate: addCalendarDays(today, business!.terms),
          items: quote.items.map(({ description, quantity, unitPrice }) => ({
            description,
            quantity,
            unitPrice,
          })),
          discount: quote.discount,
          taxRate: quote.taxRate,
          paymentInstructions: null,
          notes: quote.notes,
        },
        tx,
      );
      await tx
        .update(quotes)
        .set({ status: "converted", convertedInvoiceId: invoice.id })
        .where(eq(quotes.id, quoteId));
      return { invoiceId: invoice.id, created: true };
    });
  }
}
