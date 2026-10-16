import type {
  Invoice,
  InvoiceBusinessDetails,
  InvoiceClientDetails,
  InvoiceSummary,
} from "@tallynest/contracts";
import type { schema } from "@tallynest/db";

type InvoiceRow = typeof schema.invoices.$inferSelect;
type ItemRow = typeof schema.invoiceItems.$inferSelect;
type ClientRow = typeof schema.clients.$inferSelect;
type BusinessRow = typeof schema.businesses.$inferSelect;

const NO_PAYMENTS = "0.00";

export function clientDetails(client: ClientRow): InvoiceClientDetails {
  return {
    name: client.name,
    phone: client.phone,
    email: client.email,
    companyName: client.companyName,
    address: client.address,
    kraPin: client.kraPin,
  };
}

export function businessDetails(business: BusinessRow): InvoiceBusinessDetails {
  return {
    displayName: business.displayName,
    contactEmail: business.contactEmail,
    phone: business.phone,
    address: business.address,
    kraPin: business.kraPin,
    logoKey: business.logoKey,
  };
}

export function toInvoiceSummary(row: InvoiceRow, clientName: string): InvoiceSummary {
  return {
    id: row.id,
    status: row.status,
    invoiceNumber: row.invoiceNumber,
    clientName,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    currency: row.currency,
    total: row.total,
    balanceDue: row.total,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Drafts show current saved details; Ready and later show the copy taken at Ready (D048). */
export function toInvoice(
  row: InvoiceRow,
  items: ItemRow[],
  live: { client: ClientRow; business: BusinessRow },
): Invoice {
  const client = row.clientSnapshot ?? clientDetails(live.client);
  const business = row.businessSnapshot ?? businessDetails(live.business);
  return {
    ...toInvoiceSummary(row, client.name),
    clientId: row.clientId,
    client,
    business,
    items: items
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        id: item.id,
        position: item.position,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
    discount:
      row.discountType && row.discountValue
        ? { type: row.discountType, value: row.discountValue }
        : null,
    taxRate: row.taxRate,
    subtotal: row.subtotal,
    discountAmount: row.discountAmount,
    taxAmount: row.taxAmount,
    paymentsReceived: NO_PAYMENTS,
    paymentInstructions: row.paymentInstructions,
    notes: row.notes,
    readyAt: row.readyAt?.toISOString() ?? null,
  };
}
