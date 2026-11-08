import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Quote, QuoteResponse, QuoteVersion, SaveQuote } from "@billsafi/contracts";
import { and, asc, type DatabaseConnection, desc, eq, schema, sql } from "@billsafi/db";
import {
  addCalendarDays,
  calculateInvoice,
  DiscountExceedsSubtotalError,
  formatDocumentNumber,
  nairobiDate,
  QUOTE_VALIDITY_DAYS,
  quoteAllows,
  quoteContentChanged,
  quoteDisplayStatus,
  type QuoteStatus,
} from "@billsafi/domain";
import { containsPattern } from "../common/like-pattern.js";
import { DATABASE } from "../database/database.module.js";
import type { Executor, Transaction } from "../database/transaction.js";
import { businessDetails, clientDetails } from "../invoices/invoice.mapper.js";
import { quoteContentOf, toQuote, toQuoteSummary, toVersionContent } from "./quote.mapper.js";
import { SavedItemsService } from "../items/saved-items.service.js";

const { quotes, quoteItems, quoteVersions, quoteAcceptances, quoteLinks, clients, businesses } =
  schema;

export type QuoteListFilter = { status?: QuoteStatus | "expired"; search?: string };

export function invalid(path: string, message: string): BadRequestException {
  return new BadRequestException({ message, issues: [{ path, message }] });
}

export class QuoteLockedException extends ConflictException {
  constructor() {
    super({
      code: "QUOTE_LOCKED",
      message: "This quote can't be changed any more. Duplicate it to make a new one.",
    });
  }
}

type QuoteRow = typeof quotes.$inferSelect;

@Injectable()
export class QuotesService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly savedItems: SavedItemsService,
  ) {}

  private get db() {
    return this.connection.db;
  }

  async list(businessId: string, filter: QuoteListFilter) {
    const clientName = sql<string>`coalesce(${quotes.clientSnapshot}->>'name', ${clients.name})`;
    const today = nairobiDate(new Date());
    const conditions = [eq(quotes.businessId, businessId)];
    if (filter.status === "expired") {
      conditions.push(sql`${quotes.status} = 'sent' and ${quotes.validUntil} < ${today}`);
    } else if (filter.status === "sent") {
      conditions.push(sql`${quotes.status} = 'sent' and ${quotes.validUntil} >= ${today}`);
    } else if (filter.status) {
      conditions.push(eq(quotes.status, filter.status));
    }
    if (filter.search) {
      const pattern = containsPattern(filter.search);
      conditions.push(
        sql`(${quotes.quoteNumber} ilike ${pattern} or ${clientName} ilike ${pattern})`,
      );
    }
    const rows = await this.db
      .select({ quote: quotes, clientName })
      .from(quotes)
      .innerJoin(clients, eq(clients.id, quotes.clientId))
      .where(and(...conditions))
      .orderBy(desc(quotes.updatedAt));
    const now = new Date();
    return rows.map((row) => toQuoteSummary(row.quote, row.clientName, now));
  }

  get(businessId: string, quoteId: string) {
    return this.load(this.db, businessId, quoteId);
  }

  async createDraft(businessId: string, input: SaveQuote) {
    return this.db.transaction(async (tx) => {
      await this.lockNumbering(tx, businessId);
      await this.checkNumber(tx, businessId, input.quoteNumber);
      await this.selectableClient(tx, businessId, input.clientId);
      const totals = this.calculate(input);
      const [quote] = await tx
        .insert(quotes)
        .values({
          businessId,
          quoteNumber: input.quoteNumber || null,
          ...this.columns(input, totals),
        })
        .returning();
      await this.replaceItems(tx, businessId, quote!.id, input, totals.lineTotals);
      return this.load(tx, businessId, quote!.id);
    });
  }

  /** Sent and declined quotes stay editable; a content change saves a new version. */
  async update(userId: string, businessId: string, quoteId: string, input: SaveQuote) {
    return this.db.transaction(async (tx) => {
      const current = await this.lockQuote(tx, businessId, quoteId);
      if (!quoteAllows("edit", quoteDisplayStatus(current.status, current.validUntil))) {
        throw new QuoteLockedException();
      }
      await this.lockNumbering(tx, businessId);
      const quoteNumber =
        input.quoteNumber === undefined
          ? current.quoteNumber
          : input.quoteNumber || (current.status === "draft" ? null : current.systemQuoteNumber);
      await this.checkNumber(tx, businessId, quoteNumber, quoteId);
      const reservedQuoteNumbers =
        current.status === "draft"
          ? current.reservedQuoteNumbers
          : [...new Set([...current.reservedQuoteNumbers, quoteNumber!])];
      if (input.clientId !== current.clientId) {
        await this.selectableClient(tx, businessId, input.clientId);
      }
      if (current.status !== "draft" && input.items.length === 0) {
        throw invalid("items", "A sent quote needs at least one line item");
      }
      const totals = this.calculate(input);
      const snapshots =
        current.status === "draft" ? {} : await this.snapshots(tx, businessId, input.clientId);
      await tx
        .update(quotes)
        .set({ ...this.columns(input, totals), quoteNumber, reservedQuoteNumbers, ...snapshots })
        .where(eq(quotes.id, quoteId));
      await this.replaceItems(tx, businessId, quoteId, input, totals.lineTotals);
      if (current.status !== "draft")
        await this.saveVersionIfChanged(tx, userId, businessId, quoteId);
      return this.load(tx, businessId, quoteId);
    });
  }

  /**
   * Sends a draft, or resends a declined or expired quote. Returns false when it did
   * nothing because the quote was already sent. The caller creates the link in the same
   * transaction.
   */
  async send(
    tx: Transaction,
    userId: string,
    businessId: string,
    quoteId: string,
  ): Promise<boolean> {
    const current = await this.lockQuote(tx, businessId, quoteId);
    const status = quoteDisplayStatus(current.status, current.validUntil);
    if (status === "sent") return false;
    if (!quoteAllows("send", status)) {
      throw new ConflictException("Only draft, declined and expired quotes can be sent");
    }
    const items = await tx
      .select({ id: quoteItems.id })
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, quoteId));
    if (items.length === 0) throw invalid("items", "Add at least one line item first");
    const client = await this.findClient(tx, businessId, current.clientId);
    if (client.archivedAt) {
      throw invalid("clientId", "This client is archived. Choose an active client.");
    }
    if (current.validUntil < nairobiDate(new Date())) {
      throw invalid("validUntil", "Choose a valid-until date from today");
    }

    const now = new Date();
    let numbering = {};
    if (current.status === "draft") {
      await this.lockNumbering(tx, businessId);
      await this.checkNumber(tx, businessId, current.quoteNumber, quoteId);
      let sequence: number;
      let systemQuoteNumber: string;
      do {
        const [row] = await tx
          .update(businesses)
          .set({ nextQuoteSequence: sql`${businesses.nextQuoteSequence} + 1` })
          .where(eq(businesses.id, businessId))
          .returning({ next: businesses.nextQuoteSequence });
        sequence = row!.next - 1;
        systemQuoteNumber = formatDocumentNumber("QT", sequence);
      } while (await this.numberTaken(tx, businessId, systemQuoteNumber, quoteId));
      const quoteNumber = current.quoteNumber || systemQuoteNumber;
      numbering = {
        sequenceNumber: sequence,
        quoteNumber,
        systemQuoteNumber,
        reservedQuoteNumbers: [...new Set([systemQuoteNumber, quoteNumber])],
      };
    }
    await tx
      .update(quotes)
      .set({
        status: "sent",
        sentAt: now,
        declinedAt: null,
        declineReason: null,
        ...numbering,
        ...(await this.snapshots(tx, businessId, current.clientId)),
      })
      .where(eq(quotes.id, quoteId));
    await this.saveVersionIfChanged(tx, userId, businessId, quoteId);
    return true;
  }

  async withdraw(businessId: string, quoteId: string) {
    return this.db.transaction(async (tx) => {
      const current = await this.lockQuote(tx, businessId, quoteId);
      if (current.status === "withdrawn") return this.load(tx, businessId, quoteId);
      if (!quoteAllows("withdraw", quoteDisplayStatus(current.status, current.validUntil))) {
        throw new ConflictException("Only sent, declined and expired quotes can be withdrawn");
      }
      const now = new Date();
      await tx
        .update(quotes)
        .set({ status: "withdrawn", withdrawnAt: now })
        .where(eq(quotes.id, quoteId));
      await tx
        .update(quoteLinks)
        .set({ revokedAt: now })
        .where(and(eq(quoteLinks.quoteId, quoteId), sql`${quoteLinks.revokedAt} is null`));
      return this.load(tx, businessId, quoteId);
    });
  }

  async deleteDraft(businessId: string, quoteId: string) {
    await this.db.transaction(async (tx) => {
      const current = await this.lockQuote(tx, businessId, quoteId);
      if (current.status !== "draft")
        throw new ConflictException("Only draft quotes can be deleted");
      await tx.delete(quotes).where(eq(quotes.id, quoteId));
    });
  }

  /** A new draft with the same client and content, dated today. */
  async duplicate(businessId: string, quoteId: string) {
    const source = await this.get(businessId, quoteId);
    const today = nairobiDate(new Date());
    return this.createDraft(businessId, {
      clientId: source.clientId,
      quoteNumber: null,
      issueDate: today,
      validUntil: addCalendarDays(today, QUOTE_VALIDITY_DAYS),
      items: source.items.map(({ description, quantity, unitPrice, savedItemId }) => ({
        description,
        quantity,
        unitPrice,
        savedItemId,
      })),
      discount: source.discount,
      taxRate: source.taxRate,
      notes: source.notes,
    });
  }

  async version(businessId: string, quoteId: string, version: number): Promise<QuoteVersion> {
    const [row] = await this.db
      .select()
      .from(quoteVersions)
      .where(
        and(
          eq(quoteVersions.businessId, businessId),
          eq(quoteVersions.quoteId, quoteId),
          eq(quoteVersions.version, version),
        ),
      );
    if (!row) throw new NotFoundException("Version not found");
    return { version: row.version, createdAt: row.createdAt.toISOString(), content: row.content };
  }

  /** The version row a client response attaches to, and when it was saved. */
  async currentVersionRow(db: Executor, quoteId: string, version: number) {
    const [row] = await db
      .select({ id: quoteVersions.id, createdAt: quoteVersions.createdAt })
      .from(quoteVersions)
      .where(and(eq(quoteVersions.quoteId, quoteId), eq(quoteVersions.version, version)));
    return row ?? null;
  }

  private async saveVersionIfChanged(
    tx: Transaction,
    userId: string,
    businessId: string,
    quoteId: string,
  ) {
    const quote = await this.load(tx, businessId, quoteId);
    const [latest] = await tx
      .select()
      .from(quoteVersions)
      .where(eq(quoteVersions.quoteId, quoteId))
      .orderBy(desc(quoteVersions.version))
      .limit(1);
    if (latest && !quoteContentChanged(quoteContentOf(latest.content), quoteContentOf(quote))) {
      return;
    }
    const version = (latest?.version ?? 0) + 1;
    await tx.insert(quoteVersions).values({
      businessId,
      quoteId,
      version,
      content: toVersionContent(quote),
      createdByUserId: userId,
    });
    await tx.update(quotes).set({ currentVersion: version }).where(eq(quotes.id, quoteId));
  }

  private calculate(input: SaveQuote) {
    try {
      return calculateInvoice({
        items: input.items,
        discount: input.discount,
        taxRate: input.taxRate,
      });
    } catch (error) {
      if (error instanceof DiscountExceedsSubtotalError)
        throw invalid("discount.value", error.message);
      throw error;
    }
  }

  private columns(input: SaveQuote, totals: ReturnType<typeof calculateInvoice>) {
    return {
      clientId: input.clientId,
      issueDate: input.issueDate,
      validUntil: input.validUntil,
      discountType: input.discount?.type ?? null,
      discountValue: input.discount?.value ?? null,
      taxRate: input.taxRate,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      total: totals.total,
      notes: input.notes ?? null,
    };
  }

  /** Rewrites the lines and counts a use for saved items newly placed on them (D080). */
  private async replaceItems(
    tx: Transaction,
    businessId: string,
    quoteId: string,
    input: SaveQuote,
    lineTotals: string[],
  ) {
    const before = await tx
      .delete(quoteItems)
      .where(eq(quoteItems.quoteId, quoteId))
      .returning({ savedItemId: quoteItems.savedItemId });
    const links = await this.savedItems.ownedLinks(
      tx,
      businessId,
      input.items.map((item) => item.savedItemId),
    );
    await this.savedItems.recordUse(
      tx,
      before.map((row) => row.savedItemId),
      links,
    );
    if (input.items.length === 0) return;
    await tx.insert(quoteItems).values(
      input.items.map((item, index) => ({
        businessId,
        quoteId,
        position: index + 1,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: lineTotals[index]!,
        savedItemId: links[index]!,
      })),
    );
  }

  /** Quote numbers share the business row lock with invoice numbering. */
  private async lockNumbering(tx: Transaction, businessId: string) {
    await tx
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .for("update");
  }

  private async numberTaken(tx: Transaction, businessId: string, value: string, quoteId?: string) {
    const [found] = await tx
      .select({ id: quotes.id })
      .from(quotes)
      .where(
        and(
          eq(quotes.businessId, businessId),
          quoteId ? sql`${quotes.id} <> ${quoteId}` : undefined,
          sql`(lower(${quotes.quoteNumber}) = lower(${value}) or exists (
        select 1 from unnest(${quotes.reservedQuoteNumbers}) as reserved(number)
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
    quoteId?: string,
  ) {
    if (value && (await this.numberTaken(tx, businessId, value, quoteId))) {
      throw invalid("quoteNumber", "This quote number is already used by another quote");
    }
  }

  private async snapshots(tx: Transaction, businessId: string, clientId: string) {
    const [business] = await tx.select().from(businesses).where(eq(businesses.id, businessId));
    const client = await this.findClient(tx, businessId, clientId);
    return { clientSnapshot: clientDetails(client), businessSnapshot: businessDetails(business!) };
  }

  async lockQuote(tx: Transaction, businessId: string, quoteId: string): Promise<QuoteRow> {
    const [quote] = await tx
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, quoteId), eq(quotes.businessId, businessId)))
      .for("update");
    if (!quote) throw new NotFoundException("Quote not found");
    return quote;
  }

  private async findClient(db: Executor, businessId: string, clientId: string) {
    const [client] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.businessId, businessId)));
    if (!client) throw invalid("clientId", "Choose a client");
    return client;
  }

  private async selectableClient(tx: Transaction, businessId: string, clientId: string) {
    const client = await this.findClient(tx, businessId, clientId);
    if (client.archivedAt) throw invalid("clientId", "This client is archived");
    return client;
  }

  async load(db: Executor, businessId: string, quoteId: string): Promise<Quote> {
    const [row] = await db
      .select({ quote: quotes, client: clients, business: businesses })
      .from(quotes)
      .innerJoin(clients, eq(clients.id, quotes.clientId))
      .innerJoin(businesses, eq(businesses.id, quotes.businessId))
      .where(and(eq(quotes.id, quoteId), eq(quotes.businessId, businessId)));
    if (!row) throw new NotFoundException("Quote not found");
    const items = await db
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, quoteId))
      .orderBy(asc(quoteItems.position));
    const versions = await db
      .select({ version: quoteVersions.version, createdAt: quoteVersions.createdAt })
      .from(quoteVersions)
      .where(eq(quoteVersions.quoteId, quoteId))
      .orderBy(asc(quoteVersions.version));
    const [latest] = await db
      .select({ response: quoteAcceptances, version: quoteVersions.version })
      .from(quoteAcceptances)
      .innerJoin(quoteVersions, eq(quoteVersions.id, quoteAcceptances.quoteVersionId))
      .where(eq(quoteAcceptances.quoteId, quoteId))
      .orderBy(desc(quoteAcceptances.createdAt))
      .limit(1);
    const response: QuoteResponse | null = latest
      ? {
          decision: latest.response.decision,
          signerName: latest.response.signerName,
          reason: latest.response.reason,
          version: latest.version,
          createdAt: latest.response.createdAt.toISOString(),
        }
      : null;
    return toQuote(
      row.quote,
      items,
      { client: row.client, business: row.business },
      versions,
      response,
    );
  }
}
