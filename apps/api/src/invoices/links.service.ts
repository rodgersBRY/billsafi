import { createHash, randomBytes } from "node:crypto";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  type CreatedInvoiceLink,
  type Invoice,
  type InvoiceLinkStatus,
  PUBLIC_LINK_LIFETIME_DAYS,
  type PublicInvoice,
} from "@billsafi/contracts";
import { and, type DatabaseConnection, desc, eq, schema, sql } from "@billsafi/db";
import { DATABASE } from "../database/database.module.js";
import { InvoicesService } from "./invoices.service.js";

const { invoiceLinks } = schema;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Tokens are 256 random bits; only their SHA-256 hash is stored (D026). */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Shown on the public page for any link that can't be used (D049). */
export class InvoiceUnavailableException extends NotFoundException {
  constructor() {
    super({ code: "INVOICE_UNAVAILABLE", message: "This invoice link is no longer available" });
  }
}

const active = sql`${invoiceLinks.revokedAt} is null and ${invoiceLinks.expiresAt} > now()`;

@Injectable()
export class LinksService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly invoices: InvoicesService,
  ) {}

  async current(businessId: string, invoiceId: string): Promise<InvoiceLinkStatus | null> {
    await this.invoices.load(this.connection.db, businessId, invoiceId);
    const [link] = await this.connection.db
      .select()
      .from(invoiceLinks)
      .where(and(eq(invoiceLinks.invoiceId, invoiceId), active))
      .orderBy(desc(invoiceLinks.createdAt))
      .limit(1);
    return link
      ? {
          id: link.id,
          expiresAt: link.expiresAt.toISOString(),
          createdAt: link.createdAt.toISOString(),
        }
      : null;
  }

  /** Creates a new 30-day link, invalidating any previous one (D026, D049). */
  async create(userId: string, businessId: string, invoiceId: string): Promise<CreatedInvoiceLink> {
    return this.connection.db.transaction(async (tx) => {
      const invoice = await this.invoices.lockInvoice(tx, businessId, invoiceId);
      if (invoice.status === "draft" || invoice.status === "cancelled") {
        throw new ConflictException("Only Ready, Partially paid and Paid invoices can be shared");
      }
      const now = new Date();
      await tx
        .update(invoiceLinks)
        .set({ revokedAt: now })
        .where(and(eq(invoiceLinks.invoiceId, invoiceId), sql`${invoiceLinks.revokedAt} is null`));

      const token = randomBytes(32).toString("base64url");
      const [link] = await tx
        .insert(invoiceLinks)
        .values({
          businessId,
          invoiceId,
          tokenHash: hashToken(token),
          createdByUserId: userId,
          createdAt: now,
          expiresAt: new Date(now.getTime() + PUBLIC_LINK_LIFETIME_DAYS * DAY_MS),
        })
        .returning();
      return {
        id: link!.id,
        token,
        expiresAt: link!.expiresAt.toISOString(),
        createdAt: link!.createdAt.toISOString(),
      };
    });
  }

  async disable(businessId: string, invoiceId: string): Promise<void> {
    await this.invoices.load(this.connection.db, businessId, invoiceId);
    await this.connection.db
      .update(invoiceLinks)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invoiceLinks.invoiceId, invoiceId),
          eq(invoiceLinks.businessId, businessId),
          sql`${invoiceLinks.revokedAt} is null`,
        ),
      );
  }

  /** The invoice behind a public token, if the link and invoice are both usable. */
  async resolve(token: string): Promise<{ businessId: string; invoice: Invoice }> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new InvoiceUnavailableException();
    const [link] = await this.connection.db
      .select()
      .from(invoiceLinks)
      .where(and(eq(invoiceLinks.tokenHash, hashToken(token)), active));
    if (!link) throw new InvoiceUnavailableException();
    const invoice = await this.invoices.load(this.connection.db, link.businessId, link.invoiceId);
    if (invoice.status === "draft" || invoice.status === "cancelled") {
      throw new InvoiceUnavailableException();
    }
    return { businessId: link.businessId, invoice };
  }
}

/** The public view: the same details as the PDF, no internal ids or payment history (D049). */
export function toPublicInvoice(invoice: Invoice, showBranding: boolean): PublicInvoice {
  const { logoKey, ...business } = invoice.business;
  return {
    invoiceNumber: invoice.invoiceNumber!,
    status: invoice.status as PublicInvoice["status"],
    overdue: invoice.overdue,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    business,
    client: { name: invoice.client.name, companyName: invoice.client.companyName },
    items: invoice.items.map(({ id: _id, ...item }) => item),
    discount: invoice.discount,
    taxRate: invoice.taxRate,
    subtotal: invoice.subtotal,
    discountAmount: invoice.discountAmount,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    paymentsReceived: invoice.paymentsReceived,
    balanceDue: invoice.balanceDue,
    paymentInstructions: invoice.paymentInstructions,
    notes: invoice.notes,
    hasLogo: logoKey !== null,
    showBranding,
  };
}
