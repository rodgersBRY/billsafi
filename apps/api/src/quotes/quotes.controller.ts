import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import {
  type AcceptQuote,
  acceptQuoteSchema,
  type ConvertQuote,
  convertQuoteSchema,
  type CreatedQuoteLink,
  type DeclineQuote,
  declineQuoteSchema,
  type PublicQuote,
  type Quote,
  type QuoteLinkStatus,
  quoteListStatuses,
  type QuoteSummary,
  type QuoteVersion,
  type SaveQuote,
  saveQuoteSchema,
  type SentQuote,
} from "@billsafi/contracts";
import { type DatabaseConnection } from "@billsafi/db";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";
import { z } from "zod";
import { ActivityRecorder } from "../activity/activity-recorder.js";
import { SlidingWindowLimiter } from "../admin/shared/rate-limit.guard.js";
import { BusinessOwnerGuard } from "../businesses/business-owner.guard.js";
import { rateLimitKey } from "../common/client-ip.js";
import { CurrentUserId } from "../common/current-user.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { DATABASE } from "../database/database.module.js";
import { BrandingService } from "../invoices/branding.service.js";
import { PdfService } from "../invoices/pdf.service.js";
import { QuoteConversionService } from "./quote-conversion.service.js";
import { QuoteLinksService } from "./quote-links.service.js";
import { toPublicQuote } from "./quote.mapper.js";
import { QuoteResponsesService } from "./quote-responses.service.js";
import { type QuoteListFilter, QuotesService } from "./quotes.service.js";

const listQuerySchema = z.object({
  status: z.enum(quoteListStatuses).optional(),
  search: z.string().trim().max(100).optional(),
});
const QuoteId = () => new UuidParamPipe("Quote");

@Controller("businesses/:businessId/quotes")
@UseGuards(BusinessOwnerGuard)
export class QuotesController {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly quotes: QuotesService,
    private readonly links: QuoteLinksService,
    private readonly conversion: QuoteConversionService,
    private readonly pdf: PdfService,
    private readonly branding: BrandingService,
    private readonly recorder: ActivityRecorder,
  ) {}

  @Get()
  list(
    @Param("businessId") businessId: string,
    @Query(new ZodValidationPipe(listQuerySchema)) query: QuoteListFilter,
  ): Promise<QuoteSummary[]> {
    return this.quotes.list(businessId, query);
  }

  @Post()
  create(
    @Param("businessId") businessId: string,
    @Body(new ZodValidationPipe(saveQuoteSchema)) input: SaveQuote,
  ): Promise<Quote> {
    return this.quotes.createDraft(businessId, input);
  }

  @Get(":quoteId")
  get(@Param("businessId") businessId: string, @Param("quoteId", QuoteId()) quoteId: string) {
    return this.quotes.get(businessId, quoteId);
  }

  @Put(":quoteId")
  update(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Param("quoteId", QuoteId()) quoteId: string,
    @Body(new ZodValidationPipe(saveQuoteSchema)) input: SaveQuote,
  ): Promise<Quote> {
    return this.quotes.update(userId, businessId, quoteId, input);
  }

  @Delete(":quoteId")
  @HttpCode(204)
  async remove(
    @Param("businessId") businessId: string,
    @Param("quoteId", QuoteId()) quoteId: string,
  ) {
    await this.quotes.deleteDraft(businessId, quoteId);
  }

  /** Numbers, versions and shares the quote. A link comes back only when one was created. */
  @Post(":quoteId/send")
  @HttpCode(200)
  async send(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Param("quoteId", QuoteId()) quoteId: string,
  ): Promise<SentQuote> {
    const link = await this.connection.db.transaction(async (tx) => {
      await this.quotes.send(tx, userId, businessId, quoteId);
      return (await this.links.hasActive(tx, quoteId))
        ? null
        : this.links.issue(tx, userId, businessId, quoteId);
    });
    this.recorder.productEvent("quote_sent", {}, { accountId: userId });
    return { quote: await this.quotes.get(businessId, quoteId), link };
  }

  @Post(":quoteId/withdraw")
  @HttpCode(200)
  withdraw(@Param("businessId") businessId: string, @Param("quoteId", QuoteId()) quoteId: string) {
    return this.quotes.withdraw(businessId, quoteId);
  }

  @Post(":quoteId/duplicate")
  duplicate(@Param("businessId") businessId: string, @Param("quoteId", QuoteId()) quoteId: string) {
    return this.quotes.duplicate(businessId, quoteId);
  }

  @Post(":quoteId/convert")
  @HttpCode(200)
  async convert(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Param("quoteId", QuoteId()) quoteId: string,
    @Body(new ZodValidationPipe(convertQuoteSchema)) input: ConvertQuote,
  ): Promise<{ invoiceId: string }> {
    const result = await this.conversion.convert(businessId, quoteId, input.confirmUnaccepted);
    this.recorder.productEvent("quote_converted", {}, { accountId: userId });
    return result;
  }

  @Get(":quoteId/versions/:version")
  version(
    @Param("businessId") businessId: string,
    @Param("quoteId", QuoteId()) quoteId: string,
    @Param("version", ParseIntPipe) version: number,
  ): Promise<QuoteVersion> {
    return this.quotes.version(businessId, quoteId, version);
  }

  @Get(":quoteId/link")
  async link(
    @Param("businessId") businessId: string,
    @Param("quoteId", QuoteId()) quoteId: string,
  ): Promise<{ link: QuoteLinkStatus | null }> {
    return { link: await this.links.current(businessId, quoteId) };
  }

  @Post(":quoteId/link")
  createLink(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Param("quoteId", QuoteId()) quoteId: string,
  ): Promise<CreatedQuoteLink> {
    return this.links.create(userId, businessId, quoteId);
  }

  @Delete(":quoteId/link")
  @HttpCode(204)
  async disableLink(
    @Param("businessId") businessId: string,
    @Param("quoteId", QuoteId()) quoteId: string,
  ) {
    await this.links.disable(businessId, quoteId);
  }

  @Get(":quoteId/pdf")
  async downloadPdf(
    @Param("businessId") businessId: string,
    @Param("quoteId", QuoteId()) quoteId: string,
  ): Promise<StreamableFile> {
    const quote = await this.quotes.get(businessId, quoteId);
    if (quote.status === "draft") throw new ConflictException("Send the quote to download a PDF");
    const view = toPublicQuote(quote, await this.branding.showBranding(businessId), null);
    const logo = await this.branding.logoByKey(businessId, quote.business.logoKey);
    return new StreamableFile(await this.pdf.renderQuote(view, logo), {
      type: "application/pdf",
      disposition: `attachment; filename="${this.pdf.quoteFileName(view)}"`,
    });
  }
}

/** Thirty answers a minute per address is plenty for a person and stops scripted tries. */
const RESPONSE_LIMITER = new SlidingWindowLimiter(30, 60_000);

@AllowAnonymous()
@Controller("public/quotes")
export class PublicQuotesController {
  constructor(
    private readonly links: QuoteLinksService,
    private readonly responses: QuoteResponsesService,
    private readonly pdf: PdfService,
    private readonly branding: BrandingService,
  ) {}

  @Get(":token")
  view(@Param("token") token: string): Promise<PublicQuote> {
    return this.responses.view(token);
  }

  @Post(":token/accept")
  @HttpCode(200)
  accept(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(acceptQuoteSchema)) input: AcceptQuote,
    @Req() req: Request,
  ): Promise<PublicQuote> {
    this.limit(req);
    return this.responses.accept(token, input, meta(req));
  }

  @Post(":token/decline")
  @HttpCode(200)
  decline(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(declineQuoteSchema)) input: DeclineQuote,
    @Req() req: Request,
  ): Promise<PublicQuote> {
    this.limit(req);
    return this.responses.decline(token, input, meta(req));
  }

  @Get(":token/pdf")
  async downloadPdf(@Param("token") token: string): Promise<StreamableFile> {
    const view = await this.responses.view(token);
    const { businessId, quote } = await this.links.resolve(token);
    const logo = await this.branding.logoByKey(businessId, quote.business.logoKey);
    return new StreamableFile(await this.pdf.renderQuote(view, logo), {
      type: "application/pdf",
      disposition: `attachment; filename="${this.pdf.quoteFileName(view)}"`,
    });
  }

  @Get(":token/logo")
  @Header("Cache-Control", "public, max-age=3600")
  async logo(@Param("token") token: string): Promise<StreamableFile> {
    const { businessId, quote } = await this.links.resolve(token);
    const logo = await this.branding.logoByKey(businessId, quote.business.logoKey);
    if (!logo) throw new NotFoundException("Logo not found");
    return new StreamableFile(logo.data, { type: logo.contentType });
  }

  private limit(req: Request) {
    if (RESPONSE_LIMITER.hit(rateLimitKey(req.ip)) > 0) {
      throw new HttpException("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}

function meta(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}
