import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  type AllowanceUsage,
  type Invoice,
  invoiceStatuses,
  type InvoiceSummary,
  type SaveInvoice,
  saveInvoiceSchema,
} from "@tallynest/contracts";
import { z } from "zod";
import { BusinessOwnerGuard } from "../businesses/business-owner.guard.js";
import { CurrentUserId } from "../common/current-user.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AllowanceService } from "./allowance.service.js";
import { type InvoiceListFilter, InvoicesService } from "./invoices.service.js";

const listQuerySchema = z.object({
  status: z.enum(invoiceStatuses).optional(),
  search: z.string().trim().max(100).optional(),
});

@Controller("businesses/:businessId/invoices")
@UseGuards(BusinessOwnerGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

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
    @Param("invoiceId", new UuidParamPipe("Invoice")) invoiceId: string,
  ): Promise<Invoice> {
    return this.invoices.get(businessId, invoiceId);
  }

  @Put(":invoiceId")
  update(
    @Param("businessId") businessId: string,
    @Param("invoiceId", new UuidParamPipe("Invoice")) invoiceId: string,
    @Body(new ZodValidationPipe(saveInvoiceSchema)) input: SaveInvoice,
  ): Promise<Invoice> {
    return this.invoices.update(businessId, invoiceId, input);
  }

  @Delete(":invoiceId")
  @HttpCode(204)
  async remove(
    @Param("businessId") businessId: string,
    @Param("invoiceId", new UuidParamPipe("Invoice")) invoiceId: string,
  ): Promise<void> {
    await this.invoices.deleteDraft(businessId, invoiceId);
  }

  @Post(":invoiceId/ready")
  @HttpCode(200)
  markReady(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Param("invoiceId", new UuidParamPipe("Invoice")) invoiceId: string,
  ): Promise<Invoice> {
    return this.invoices.markReady(userId, businessId, invoiceId);
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
