import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import {
  type AllowanceUsage,
  type CorrectPayment,
  type CreatedInvoiceLink,
  correctPaymentSchema,
  type Dashboard,
  type Invoice,
  type InvoiceLinkStatus,
  INVOICE_LIMITS,
  invoiceStatuses,
  type InvoiceSummary,
  optionalText,
  type Payment,
  type PublicInvoice,
  type RecordPayment,
  recordPaymentSchema,
  reversePaymentSchema,
  type SaveInvoice,
  saveInvoiceSchema,
} from "@tallynest/contracts";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { z } from "zod";
import { BusinessOwnerGuard } from "../businesses/business-owner.guard.js";
import { CurrentUserId } from "../common/current-user.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AllowanceService } from "../billing/allowance.service.js";
import { DashboardService } from "./dashboard.service.js";
import { type InvoiceListFilter, InvoicesService } from "./invoices.service.js";
import { LinksService, toPublicInvoice } from "./links.service.js";
import { PaymentsService } from "./payments.service.js";
import { PdfService } from "./pdf.service.js";

const listQuerySchema = z.object({
  status: z.enum([...invoiceStatuses, "overdue"]).optional(),
  search: z.string().trim().max(100).optional(),
});

const notesSchema = z.object({ notes: optionalText(INVOICE_LIMITS.notesLength) });
const InvoiceId = () => new UuidParamPipe("Invoice");
const PaymentId = () => new UuidParamPipe("Payment");

async function pdfFile(pdf: PdfService, invoice: PublicInvoice) {
  return new StreamableFile(await pdf.render(invoice), {
    type: "application/pdf",
    disposition: `attachment; filename="${pdf.fileName(invoice)}"`,
  });
}

@Controller("businesses/:businessId/invoices")
@UseGuards(BusinessOwnerGuard)
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
    private readonly links: LinksService,
    private readonly pdf: PdfService,
  ) {}

  @Get()
  list(
    @Param("businessId") businessId: string,
    @Query(new ZodValidationPipe(listQuerySchema)) query: InvoiceListFilter,
  ): Promise<InvoiceSummary[]> {
    return this.invoices.list(businessId, query);
  }

  @Post()
  create(
    @Param("businessId") businessId: string,
    @Body(new ZodValidationPipe(saveInvoiceSchema)) input: SaveInvoice,
  ): Promise<Invoice> {
    return this.invoices.createDraft(businessId, input);
  }

  @Get(":invoiceId")
  get(
    @Param("businessId") businessId: string,
    @Param("invoiceId", InvoiceId()) invoiceId: string,
  ): Promise<Invoice> {
    return this.invoices.get(businessId, invoiceId);
  }

  @Put(":invoiceId")
  update(
    @Param("businessId") businessId: string,
    @Param("invoiceId", InvoiceId()) invoiceId: string,
    @Body(new ZodValidationPipe(saveInvoiceSchema)) input: SaveInvoice,
  ): Promise<Invoice> {
    return this.invoices.update(businessId, invoiceId, input);
  }

  @Patch(":invoiceId/notes")
  updateNotes(
    @Param("businessId") businessId: string,
    @Param("invoiceId", InvoiceId()) invoiceId: string,
    @Body(new ZodValidationPipe(notesSchema)) input: z.output<typeof notesSchema>,
  ): Promise<Invoice> {
    return this.invoices.updateNotes(businessId, invoiceId, input.notes ?? null);
  }

  @Delete(":invoiceId")
  @HttpCode(204)
  async remove(
    @Param("businessId") businessId: string,
    @Param("invoiceId", InvoiceId()) invoiceId: string,
  ): Promise<void> {
    await this.invoices.deleteDraft(businessId, invoiceId);
  }

  @Post(":invoiceId/ready")
  @HttpCode(200)
  markReady(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Param("invoiceId", InvoiceId()) invoiceId: string,
  ): Promise<Invoice> {
    return this.invoices.markReady(userId, businessId, invoiceId);
  }

  @Post(":invoiceId/cancel")
  @HttpCode(200)
  cancel(
    @Param("businessId") businessId: string,
    @Param("invoiceId", InvoiceId()) invoiceId: string,
  ): Promise<Invoice> {
    return this.invoices.cancel(businessId, invoiceId);
  }

  @Get(":invoiceId/payments")
  listPayments(
    @Param("businessId") businessId: string,
    @Param("invoiceId", InvoiceId()) invoiceId: string,
  ): Promise<Payment[]> {
    return this.payments.list(businessId, invoiceId);
  }

  @Post(":invoiceId/payments")
  recordPayment(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Param("invoiceId", InvoiceId()) invoiceId: string,
    @Body(new ZodValidationPipe(recordPaymentSchema)) input: RecordPayment,
  ): Promise<Invoice> {
    return this.payments.record(userId, businessId, invoiceId, input);
  }

  @Post(":invoiceId/payments/:paymentId/correct")
  @HttpCode(200)
  correctPayment(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Param("invoiceId", InvoiceId()) invoiceId: string,
    @Param("paymentId", PaymentId()) paymentId: string,
    @Body(new ZodValidationPipe(correctPaymentSchema)) input: CorrectPayment,
  ): Promise<Invoice> {
    return this.payments.correct(userId, businessId, invoiceId, paymentId, input);
  }

  @Post(":invoiceId/payments/:paymentId/reverse")
  @HttpCode(200)
  reversePayment(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Param("invoiceId", InvoiceId()) invoiceId: string,
    @Param("paymentId", PaymentId()) paymentId: string,
    @Body(new ZodValidationPipe(reversePaymentSchema)) input: z.output<typeof reversePaymentSchema>,
  ): Promise<Invoice> {
    return this.payments.reverse(userId, businessId, invoiceId, paymentId, input.reason);
  }

  /** Wrapped so "no link" is valid JSON rather than an empty body. */
  @Get(":invoiceId/link")
  async link(
    @Param("businessId") businessId: string,
    @Param("invoiceId", InvoiceId()) invoiceId: string,
  ): Promise<{ link: InvoiceLinkStatus | null }> {
    return { link: await this.links.current(businessId, invoiceId) };
  }

  /** Creates a 30-day link; any earlier link stops working (D026, D049). */
  @Post(":invoiceId/link")
  createLink(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Param("invoiceId", InvoiceId()) invoiceId: string,
  ): Promise<CreatedInvoiceLink> {
    return this.links.create(userId, businessId, invoiceId);
  }

  @Delete(":invoiceId/link")
  @HttpCode(204)
  async disableLink(
    @Param("businessId") businessId: string,
    @Param("invoiceId", InvoiceId()) invoiceId: string,
  ): Promise<void> {
    await this.links.disable(businessId, invoiceId);
  }

  @Get(":invoiceId/pdf")
  async downloadPdf(
    @Param("businessId") businessId: string,
    @Param("invoiceId", InvoiceId()) invoiceId: string,
  ): Promise<StreamableFile> {
    const invoice = await this.invoices.get(businessId, invoiceId);
    if (invoice.status === "draft") {
      throw new ConflictException("Mark the invoice as Ready to download a PDF");
    }
    return pdfFile(this.pdf, toPublicInvoice(invoice));
  }
}

@Controller("businesses/:businessId/dashboard")
@UseGuards(BusinessOwnerGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@Param("businessId") businessId: string): Promise<Dashboard> {
    return this.dashboard.get(businessId);
  }
}

/** Account-wide allowance: one plan covers every business (D018). */
@Controller("usage")
export class UsageController {
  constructor(private readonly allowance: AllowanceService) {}

  @Get()
  get(@CurrentUserId() userId: string): Promise<AllowanceUsage> {
    return this.allowance.usage(userId);
  }
}

/** Account-free invoice viewing through a link token (D011, D026). */
@AllowAnonymous()
@Controller("public/invoices")
export class PublicInvoicesController {
  constructor(
    private readonly links: LinksService,
    private readonly pdf: PdfService,
  ) {}

  @Get(":token")
  async view(@Param("token") token: string): Promise<PublicInvoice> {
    return toPublicInvoice(await this.links.resolve(token));
  }

  @Get(":token/pdf")
  async downloadPdf(@Param("token") token: string): Promise<StreamableFile> {
    return pdfFile(this.pdf, toPublicInvoice(await this.links.resolve(token)));
  }
}
