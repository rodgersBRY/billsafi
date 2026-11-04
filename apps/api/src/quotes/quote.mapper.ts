import type {
  PublicQuote,
  Quote,
  QuoteResponse,
  QuoteSummary,
  QuoteVersionContent,
} from "@billsafi/contracts";
import type { schema } from "@billsafi/db";
import { isQuoteExpired, type QuoteContent } from "@billsafi/domain";
import { businessDetails, clientDetails } from "../invoices/invoice.mapper.js";

type QuoteRow = typeof schema.quotes.$inferSelect;
type ItemRow = typeof schema.quoteItems.$inferSelect;
type ClientRow = typeof schema.clients.$inferSelect;
type BusinessRow = typeof schema.businesses.$inferSelect;

const items = (rows: ItemRow[]) =>
  [...rows]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      id: item.id,
      position: item.position,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    }));

const discountOf = (row: QuoteRow) =>
  row.discountType && row.discountValue
    ? { type: row.discountType, value: row.discountValue }
    : null;

export function toQuoteSummary(row: QuoteRow, clientName: string, now = new Date()): QuoteSummary {
  return {
    id: row.id,
    status: row.status,
    expired: isQuoteExpired(row.status, row.validUntil, now),
    quoteNumber: row.quoteNumber,
    clientName,
    issueDate: row.issueDate,
    validUntil: row.validUntil,
    currency: row.currency,
    total: row.total,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toQuote(
  row: QuoteRow,
  itemRows: ItemRow[],
  live: { client: ClientRow; business: BusinessRow },
  versions: { version: number; createdAt: Date }[],
  response: QuoteResponse | null,
): Quote {
  const client = row.clientSnapshot ?? clientDetails(live.client);
  const business = row.businessSnapshot ?? businessDetails(live.business);
  return {
    ...toQuoteSummary(row, client.name),
    clientId: row.clientId,
    client,
    business,
    items: items(itemRows),
    discount: discountOf(row),
    taxRate: row.taxRate,
    subtotal: row.subtotal,
    discountAmount: row.discountAmount,
    taxAmount: row.taxAmount,
    notes: row.notes,
    version: row.currentVersion,
    versions: versions.map((v) => ({ version: v.version, createdAt: v.createdAt.toISOString() })),
    response,
    sentAt: row.sentAt?.toISOString() ?? null,
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
    convertedInvoiceId: row.convertedInvoiceId,
  };
}

/** The parts of a quote that make a new version when they change. */
export function quoteContentOf(source: {
  currency: string;
  validUntil: string;
  discount: { type: "fixed" | "percentage"; value: string } | null;
  taxRate: string | null;
  notes: string | null;
  items: { description: string; quantity: string; unitPrice: string }[];
}): QuoteContent {
  return {
    currency: source.currency,
    validUntil: source.validUntil,
    discount: source.discount,
    taxRate: source.taxRate,
    notes: source.notes,
    items: source.items.map(({ description, quantity, unitPrice }) => ({
      description,
      quantity,
      unitPrice,
    })),
  };
}

/** Freezes a sent quote for its version row. */
export function toVersionContent(quote: Quote): QuoteVersionContent {
  return {
    quoteNumber: quote.quoteNumber!,
    issueDate: quote.issueDate,
    validUntil: quote.validUntil,
    currency: quote.currency,
    client: quote.client,
    business: quote.business,
    items: quote.items.map(({ id: _id, ...item }) => item),
    discount: quote.discount,
    taxRate: quote.taxRate,
    subtotal: quote.subtotal,
    discountAmount: quote.discountAmount,
    taxAmount: quote.taxAmount,
    total: quote.total,
    notes: quote.notes,
  };
}

export function toPublicQuote(
  quote: Quote,
  showBranding: boolean,
  currentVersionCreatedAt: Date | null,
): PublicQuote {
  const { logoKey, ...business } = quote.business;
  const accepted =
    quote.response?.decision === "accepted" &&
    (quote.status === "accepted" || quote.status === "converted");
  return {
    quoteNumber: quote.quoteNumber!,
    version: quote.version!,
    status: quote.status === "converted" ? "accepted" : (quote.status as PublicQuote["status"]),
    expired: quote.expired,
    issueDate: quote.issueDate,
    validUntil: quote.validUntil,
    currency: quote.currency,
    business,
    client: { name: quote.client.name, companyName: quote.client.companyName },
    items: quote.items.map(({ id: _id, ...item }) => item),
    discount: quote.discount,
    taxRate: quote.taxRate,
    subtotal: quote.subtotal,
    discountAmount: quote.discountAmount,
    taxAmount: quote.taxAmount,
    total: quote.total,
    notes: quote.notes,
    updatedAt:
      quote.version && quote.version > 1 && currentVersionCreatedAt
        ? currentVersionCreatedAt.toISOString()
        : null,
    acceptedBy: accepted
      ? { name: quote.response!.signerName!, at: quote.response!.createdAt }
      : null,
    hasLogo: logoKey !== null,
    showBranding,
  };
}
