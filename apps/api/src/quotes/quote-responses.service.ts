import { ConflictException, Inject, Injectable, Logger } from "@nestjs/common";
import type { AcceptQuote, DeclineQuote, PublicQuote } from "@billsafi/contracts";
import { type DatabaseConnection, eq, schema } from "@billsafi/db";
import { nairobiDate, quoteDisplayStatus } from "@billsafi/domain";
import { ActivityRecorder } from "../activity/activity-recorder.js";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { DATABASE } from "../database/database.module.js";
import { MAILER } from "../mail/mail.module.js";
import type { Mailer } from "../mail/mailer.js";
import { quoteResponseEmail } from "../mail/templates.js";
import { BrandingService } from "../invoices/branding.service.js";
import { QuoteLinksService, QuoteUnavailableException } from "./quote-links.service.js";
import { toPublicQuote } from "./quote.mapper.js";
import { QuotesService } from "./quotes.service.js";

const { quotes, quoteAcceptances, businesses } = schema;

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class QuoteResponsesService {
  private readonly logger = new Logger(QuoteResponsesService.name);

  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Env,
    private readonly quotes: QuotesService,
    private readonly links: QuoteLinksService,
    private readonly branding: BrandingService,
    private readonly recorder: ActivityRecorder,
  ) {}

  async view(token: string): Promise<PublicQuote> {
    const { businessId, quote, linkId, ownerId } = await this.links.resolve(token);
    const version = quote.version
      ? await this.quotes.currentVersionRow(this.connection.db, quote.id, quote.version)
      : null;
    this.recorder.productEvent(
      "quote_link_opened",
      {},
      { accountId: ownerId, dedupeKey: `quote_link_opened:${linkId}:${nairobiDate(new Date())}` },
    );
    return toPublicQuote(
      quote,
      await this.branding.showBranding(businessId),
      version?.createdAt ?? null,
    );
  }

  accept(token: string, input: AcceptQuote, meta: RequestMeta) {
    return this.respond(
      token,
      { decision: "accepted", signerName: input.name, reason: null },
      meta,
    );
  }

  decline(token: string, input: DeclineQuote, meta: RequestMeta) {
    return this.respond(
      token,
      { decision: "declined", signerName: null, reason: input.reason ?? null },
      meta,
    );
  }

  private async respond(
    token: string,
    response: {
      decision: "accepted" | "declined";
      signerName: string | null;
      reason: string | null;
    },
    meta: RequestMeta,
  ): Promise<PublicQuote> {
    const { businessId, quote: resolved, ownerId } = await this.links.resolve(token);
    await this.connection.db.transaction(async (tx) => {
      const current = await this.quotes.lockQuote(tx, businessId, resolved.id);
      const status = quoteDisplayStatus(current.status, current.validUntil);
      if (status === "expired") {
        throw new ConflictException({
          code: "QUOTE_EXPIRED",
          message: `This quote expired on ${current.validUntil}`,
        });
      }
      if (status === "accepted" || status === "declined" || status === "converted") {
        throw new ConflictException({
          code: "QUOTE_ALREADY_RESPONDED",
          message: "This quote has already been answered",
        });
      }
      if (status !== "sent" || !current.currentVersion) throw new QuoteUnavailableException();
      const version = await this.quotes.currentVersionRow(tx, current.id, current.currentVersion);
      const now = new Date();
      await tx.insert(quoteAcceptances).values({
        businessId,
        quoteId: current.id,
        quoteVersionId: version!.id,
        decision: response.decision,
        signerName: response.signerName,
        reason: response.reason,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 500) ?? null,
        createdAt: now,
      });
      await tx
        .update(quotes)
        .set(
          response.decision === "accepted"
            ? { status: "accepted", acceptedAt: now }
            : { status: "declined", declinedAt: now, declineReason: response.reason },
        )
        .where(eq(quotes.id, current.id));
    });

    this.recorder.productEvent(
      response.decision === "accepted" ? "quote_accepted" : "quote_declined",
      {},
      { accountId: ownerId },
    );
    // After commit: a failed email never undoes the client's answer.
    await this.notify(businessId, resolved.id, ownerId, response);
    return this.view(token);
  }

  private async notify(
    businessId: string,
    quoteId: string,
    ownerId: string,
    response: {
      decision: "accepted" | "declined";
      signerName: string | null;
      reason: string | null;
    },
  ) {
    try {
      const quote = await this.quotes.get(businessId, quoteId);
      const [business] = await this.connection.db
        .select({ email: businesses.contactEmail, name: businesses.displayName })
        .from(businesses)
        .where(eq(businesses.id, businessId));
      const url = new URL(`/${businessId}/quotes/${quoteId}`, this.env.WEB_ORIGIN).href;
      await this.mailer.send(
        quoteResponseEmail(
          business!.email,
          business!.name,
          {
            decision: response.decision,
            quoteNumber: quote.quoteNumber!,
            clientName: quote.client.name,
            signerName: response.signerName,
            reason: response.reason,
          },
          url,
        ),
        { operation: "quote_response_email", accountId: ownerId },
      );
    } catch {
      // RecordingMailer has already recorded the failure.
      this.logger.warn("Quote response email failed");
    }
  }
}
