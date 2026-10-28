import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { SaveInvoice } from "@billsafi/contracts";
import { and, asc, type DatabaseConnection, desc, eq, schema, sql } from "@billsafi/db";
import {
  calculateInvoice,
  DiscountExceedsSubtotalError,
  formatInvoiceNumber,
} from "@billsafi/domain";
import { nairobiDate } from "@billsafi/domain";
import { containsPattern } from "../common/like-pattern.js";
import { DATABASE } from "../database/database.module.js";
import type { Executor, Transaction } from "../database/transaction.js";
import { AllowanceService } from "../billing/allowance.service.js";
import { effectivePaymentsSql } from "./effective-payments.js";
import { businessDetails, clientDetails, toInvoice, toInvoiceSummary } from "./invoice.mapper.js";

const { invoices, invoiceItems, invoiceIssuances, invoiceLinks, clients, businesses } = schema;

export type InvoiceListFilter = {
  status?: (typeof invoices.status.enumValues)[number] | "overdue";
  search?: string;
};

/** Statuses whose financial details may change, until payment activity locks them (D043). */
const EDITABLE = new Set(["draft", "ready"]);

function invalid(path: string, message: string): BadRequestException {
  return new BadRequestException({ message, issues: [{ path, message }] });
}

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly allowance: AllowanceService,
  ) {}

  private get db() {
    return this.connection.db;
  }

  async list(businessId: string, filter: InvoiceListFilter) {
    const clientName = sql<string>`coalesce(${invoices.clientSnapshot}->>'name', ${clients.name})`;
    const conditions = [eq(invoices.businessId, businessId)];
    if (filter.status === "overdue") {
      // Overdue from the day after the due date in Nairobi (D049).
      conditions.push(
        sql`${invoices.status} in ('ready', 'partially_paid') and ${invoices.dueDate} < ${nairobiDate(new Date())}`,
      );
    } else if (filter.status) {
      conditions.push(eq(invoices.status, filter.status));
    }
    if (filter.search) {
      const pattern = containsPattern(filter.search);
      conditions.push(
        sql`(${invoices.invoiceNumber} ilike ${pattern} or ${clientName} ilike ${pattern})`,
      );
    }
    const rows = await this.db
      .select({ invoice: invoices, clientName, paid: effectivePaymentsSql })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(and(...conditions))
      .orderBy(desc(invoices.updatedAt));
    const now = new Date();
    return rows.map((row) => toInvoiceSummary(row.invoice, row.clientName, row.paid, now));
  }

  async get(businessId: string, invoiceId: string) {
    return this.load(this.db, businessId, invoiceId);
  }

  async createDraft(businessId: string, input: SaveInvoice, db: Executor = this.db) {
    return db.transaction(async (tx) => {
      await this.lockNumbering(tx, businessId);
      await this.checkNumber(tx, businessId, input.invoiceNumber);
      await this.selectableClient(tx, businessId, input.clientId);
      const totals = this.calculate(input);
      const [invoice] = await tx
        .insert(invoices)
        .values({
          businessId,
          invoiceNumber: input.invoiceNumber || null,
          ...this.invoiceColumns(input, totals),
        })
        .returning();
      await this.replaceItems(tx, businessId, invoice!.id, input, totals.lineTotals);
      return this.load(tx, businessId, invoice!.id);
    });
  }

  async update(businessId: string, invoiceId: string, input: SaveInvoice) {
    return this.db.transaction(async (tx) => {
      const current = await this.lockInvoice(tx, businessId, invoiceId);
      if (!EDITABLE.has(current.status) || current.paymentActivityAt) {
        throw new ConflictException(
          "Payments have been recorded, so only the notes on this invoice can change",
        );
      }
      await this.lockNumbering(tx, businessId);
      const invoiceNumber =
        input.invoiceNumber === undefined
          ? current.invoiceNumber
          : input.invoiceNumber ||
            (current.status === "draft" ? null : current.systemInvoiceNumber);
      await this.checkNumber(tx, businessId, invoiceNumber, invoiceId);
      const reservedInvoiceNumbers =
        current.status === "draft"
          ? current.reservedInvoiceNumbers
          : [...new Set([...current.reservedInvoiceNumbers, invoiceNumber!])];
      // Archived clients stay valid on invoices that already use them.
      if (input.clientId !== current.clientId) {
        await this.selectableClient(tx, businessId, input.clientId);
      }
      if (current.status !== "draft" && input.items.length === 0) {
        throw invalid("items", "A Ready invoice needs at least one line item");
      }
      const totals = this.calculate(input);
      const snapshots =
        current.status === "draft" ? {} : await this.snapshots(tx, businessId, input.clientId);
      await tx
        .update(invoices)
        .set({
          ...this.invoiceColumns(input, totals),
          invoiceNumber,
          reservedInvoiceNumbers,
          ...snapshots,
        })
        .where(eq(invoices.id, invoiceId));
      await this.replaceItems(tx, businessId, invoiceId, input, totals.lineTotals);
      return this.load(tx, businessId, invoiceId);
    });
  }

  /** Notes stay editable after payment activity (D009, D043). Cancelled invoices are frozen. */
  async updateNotes(businessId: string, invoiceId: string, notes: string | null) {
    return this.db.transaction(async (tx) => {
      const current = await this.lockInvoice(tx, businessId, invoiceId);
      if (current.status === "cancelled") {
        throw new ConflictException("Cancelled invoices can't be changed");
      }
      await tx.update(invoices).set({ notes }).where(eq(invoices.id, invoiceId));
      return this.load(tx, businessId, invoiceId);
    });
  }

  /**
   * Cancels an issued invoice with no effective payments (D043). Its number and
   * allowance use are kept, and any public link stops working.
   */
  async cancel(businessId: string, invoiceId: string) {
    return this.db.transaction(async (tx) => {
      const current = await this.lockInvoice(tx, businessId, invoiceId);
      if (current.status === "draft") {
        throw new ConflictException("Drafts are deleted rather than cancelled");
      }
      if (current.status === "cancelled") return this.load(tx, businessId, invoiceId);
      if (current.status !== "ready") {
        throw new ConflictException("Reverse the recorded payments before cancelling this invoice");
      }
      const now = new Date();
      await tx
        .update(invoices)
        .set({ status: "cancelled", cancelledAt: now })
        .where(eq(invoices.id, invoiceId));
      await tx
        .update(invoiceLinks)
        .set({ revokedAt: now })
        .where(and(eq(invoiceLinks.invoiceId, invoiceId), sql`${invoiceLinks.revokedAt} is null`));
      return this.load(tx, businessId, invoiceId);
    });
  }

  /** Only unissued drafts can be deleted; issued invoices are retained (D042). */
  async deleteDraft(businessId: string, invoiceId: string) {
    await this.db.transaction(async (tx) => {
      const current = await this.lockInvoice(tx, businessId, invoiceId);
      if (current.status !== "draft") {
        throw new ConflictException("Only draft invoices can be deleted");
      }
      await tx.delete(invoices).where(eq(invoices.id, invoiceId));
    });
  }

  /**
   * First transition to Ready (D019, D022, D048): check the account allowance,
   * take the business's next number, record the issuance, and copy client and
   * business details, all in one transaction. Repeats are no-ops.
   */
  async markReady(userId: string, businessId: string, invoiceId: string) {
    return this.db.transaction(async (tx) => {
      const current = await this.lockInvoice(tx, businessId, invoiceId);
      if (current.status !== "draft") return this.load(tx, businessId, invoiceId);

      const items = await tx
        .select({ id: invoiceItems.id })
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoiceId));
      if (items.length === 0) throw invalid("items", "Add at least one line item first");

      const client = await this.findClient(tx, businessId, current.clientId);
      if (client.archivedAt) {
        throw invalid("clientId", "This client is archived. Choose an active client.");
      }

      const now = new Date();
      const { usagePeriodId, source } = await this.allowance.reserve(tx, userId, now);

      await this.lockNumbering(tx, businessId);
      await this.checkNumber(tx, businessId, current.invoiceNumber, invoiceId);
      let sequence: number;
      let systemInvoiceNumber: string;
      do {
        const [numbering] = await tx
          .update(businesses)
          .set({ nextInvoiceSequence: sql`${businesses.nextInvoiceSequence} + 1` })
          .where(eq(businesses.id, businessId))
          .returning({ next: businesses.nextInvoiceSequence });
        sequence = numbering!.next - 1;
        systemInvoiceNumber = formatInvoiceNumber(sequence);
      } while (await this.numberTaken(tx, businessId, systemInvoiceNumber, invoiceId));

      await tx.insert(invoiceIssuances).values({
        userId,
        businessId,
        invoiceId,
        usagePeriodId,
        source,
        issuedAt: now,
      });
      await tx
        .update(invoices)
        .set({
          status: "ready",
          sequenceNumber: sequence,
          invoiceNumber: current.invoiceNumber || systemInvoiceNumber,
          systemInvoiceNumber,
          reservedInvoiceNumbers: [
            ...new Set([systemInvoiceNumber, current.invoiceNumber || systemInvoiceNumber]),
          ],
          readyAt: now,
          ...(await this.snapshots(tx, businessId, current.clientId)),
        })
        .where(eq(invoices.id, invoiceId));
      return this.load(tx, businessId, invoiceId);
    });
  }

  private calculate(input: SaveInvoice) {
    try {
      return calculateInvoice({
        items: input.items,
        discount: input.discount,
        taxRate: input.taxRate,
      });
    } catch (error) {
      if (error instanceof DiscountExceedsSubtotalError) {
        throw invalid("discount.value", error.message);
      }
      throw error;
    }
  }

  /** Serialize number reservations per business, including drafts and renames. */
  private async lockNumbering(tx: Transaction, businessId: string) {
    await tx
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .for("update");
  }

  private async numberTaken(
    tx: Transaction,
    businessId: string,
    value: string,
    invoiceId?: string,
  ) {
    const [found] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.businessId, businessId),
          invoiceId ? sql`${invoices.id} <> ${invoiceId}` : undefined,
          sql`(lower(${invoices.invoiceNumber}) = lower(${value}) or exists (
        select 1 from unnest(${invoices.reservedInvoiceNumbers}) as reserved(number)
        where lower(reserved.number) = lower(${value})
      ))`,
        ),
      )
      .limit(1);
    return Boolean(found);
  }

  private async checkNumber(
    tx: Transaction,
    businessId: string,
    value: string | null | undefined,
    invoiceId?: string,
  ) {
    if (value && (await this.numberTaken(tx, businessId, value, invoiceId))) {
      throw invalid("invoiceNumber", "This invoice number is already used by another invoice");
    }
  }

  private invoiceColumns(input: SaveInvoice, totals: ReturnType<typeof calculateInvoice>) {
    return {
      clientId: input.clientId,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      discountType: input.discount?.type ?? null,
      discountValue: input.discount?.value ?? null,
      taxRate: input.taxRate,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      total: totals.total,
      paymentInstructions: input.paymentInstructions ?? null,
      notes: input.notes ?? null,
    };
  }

  private async replaceItems(
    tx: Transaction,
    businessId: string,
    invoiceId: string,
    input: SaveInvoice,
    lineTotals: string[],
  ) {
    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
    if (input.items.length === 0) return;
    await tx.insert(invoiceItems).values(
      input.items.map((item, index) => ({
        businessId,
        invoiceId,
        position: index + 1,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: lineTotals[index]!,
      })),
    );
  }

  private async snapshots(tx: Transaction, businessId: string, clientId: string) {
    const [business] = await tx.select().from(businesses).where(eq(businesses.id, businessId));
    const client = await this.findClient(tx, businessId, clientId);
    return { clientSnapshot: clientDetails(client), businessSnapshot: businessDetails(business!) };
  }

  async lockInvoice(tx: Transaction, businessId: string, invoiceId: string) {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.businessId, businessId)))
      .for("update");
    if (!invoice) throw new NotFoundException("Invoice not found");
    return invoice;
  }

  private async findClient(db: Executor, businessId: string, clientId: string) {
    const [client] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.businessId, businessId)));
    if (!client) throw invalid("clientId", "Choose a client");
    return client;
  }

  /** New selections must be active clients of this business (D010). */
  private async selectableClient(tx: Transaction, businessId: string, clientId: string) {
    const client = await this.findClient(tx, businessId, clientId);
    if (client.archivedAt) throw invalid("clientId", "This client is archived");
    return client;
  }

  async load(db: Executor, businessId: string, invoiceId: string) {
    const [row] = await db
      .select({
        invoice: invoices,
        client: clients,
        business: businesses,
        paid: effectivePaymentsSql,
      })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .innerJoin(businesses, eq(businesses.id, invoices.businessId))
      .where(and(eq(invoices.id, invoiceId), eq(invoices.businessId, businessId)));
    if (!row) throw new NotFoundException("Invoice not found");
    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoiceId))
      .orderBy(asc(invoiceItems.position));
    return toInvoice(row.invoice, items, { client: row.client, business: row.business }, row.paid);
  }
}
