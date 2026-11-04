import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreatedQuoteLink, Quote, QuoteLinkStatus } from "@billsafi/contracts";
import { and, type DatabaseConnection, desc, eq, schema, sql } from "@billsafi/db";
import { hashLinkToken, isLinkToken, newLinkToken } from "../common/link-token.js";
import { DATABASE } from "../database/database.module.js";
import type { Transaction } from "../database/transaction.js";
import { QuotesService } from "./quotes.service.js";

const { quoteLinks, businesses } = schema;

export class QuoteUnavailableException extends NotFoundException {
  constructor() {
    super({ code: "QUOTE_UNAVAILABLE", message: "This quote link is no longer available" });
  }
}

export interface ResolvedQuoteLink {
  businessId: string;
  quote: Quote;
  linkId: string;
  ownerId: string;
}

const active = sql`${quoteLinks.revokedAt} is null`;

@Injectable()
export class QuoteLinksService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly quotes: QuotesService,
  ) {}

  async current(businessId: string, quoteId: string): Promise<QuoteLinkStatus | null> {
    await this.quotes.get(businessId, quoteId);
    const [link] = await this.connection.db
      .select()
      .from(quoteLinks)
      .where(and(eq(quoteLinks.quoteId, quoteId), active))
      .orderBy(desc(quoteLinks.createdAt))
      .limit(1);
    return link ? { id: link.id, createdAt: link.createdAt.toISOString() } : null;
  }

  /** Replaces the active link. Only sent quotes can be shared. */
  async create(userId: string, businessId: string, quoteId: string): Promise<CreatedQuoteLink> {
    return this.connection.db.transaction(async (tx) => {
      const quote = await this.quotes.lockQuote(tx, businessId, quoteId);
      if (quote.status !== "sent") throw new ConflictException("Only sent quotes can be shared");
      return this.issue(tx, userId, businessId, quoteId);
    });
  }

  /** Creates a link inside the caller's transaction, revoking any earlier one. */
  async issue(tx: Transaction, userId: string, businessId: string, quoteId: string) {
    const now = new Date();
    await tx
      .update(quoteLinks)
      .set({ revokedAt: now })
      .where(and(eq(quoteLinks.quoteId, quoteId), active));
    const token = newLinkToken();
    const [link] = await tx
      .insert(quoteLinks)
      .values({
        businessId,
        quoteId,
        tokenHash: hashLinkToken(token),
        createdByUserId: userId,
        createdAt: now,
      })
      .returning();
    return { id: link!.id, token, createdAt: link!.createdAt.toISOString() };
  }

  async hasActive(tx: Transaction, quoteId: string): Promise<boolean> {
    const [link] = await tx
      .select({ id: quoteLinks.id })
      .from(quoteLinks)
      .where(and(eq(quoteLinks.quoteId, quoteId), active))
      .limit(1);
    return Boolean(link);
  }

  async disable(businessId: string, quoteId: string): Promise<void> {
    await this.quotes.get(businessId, quoteId);
    await this.connection.db
      .update(quoteLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(quoteLinks.quoteId, quoteId), eq(quoteLinks.businessId, businessId), active));
  }

  /** The quote behind a public token. Drafts and withdrawn quotes are never shown. */
  async resolve(token: string): Promise<ResolvedQuoteLink> {
    if (!isLinkToken(token)) throw new QuoteUnavailableException();
    const [found] = await this.connection.db
      .select({ link: quoteLinks, ownerId: businesses.ownerUserId })
      .from(quoteLinks)
      .innerJoin(businesses, eq(businesses.id, quoteLinks.businessId))
      .where(and(eq(quoteLinks.tokenHash, hashLinkToken(token)), active));
    if (!found) throw new QuoteUnavailableException();
    const quote = await this.quotes.get(found.link.businessId, found.link.quoteId);
    if (quote.status === "draft" || quote.status === "withdrawn")
      throw new QuoteUnavailableException();
    return {
      businessId: found.link.businessId,
      quote,
      linkId: found.link.id,
      ownerId: found.ownerId,
    };
  }
}
