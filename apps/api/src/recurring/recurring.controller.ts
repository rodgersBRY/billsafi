import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from "@nestjs/common";
import {
  type RecurringInvoice,
  type RecurringInvoiceSummary,
  type SaveRecurringInvoice,
  saveRecurringInvoiceSchema,
} from "@billsafi/contracts";
import { BusinessOwnerGuard } from "../businesses/business-owner.guard.js";
import { CurrentUserId } from "../common/current-user.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { RecurringService } from "./recurring.service.js";

const idPipe = new UuidParamPipe("Recurring invoice");

@Controller("businesses/:businessId/recurring-invoices")
@UseGuards(BusinessOwnerGuard)
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}

  @Get()
  list(@Param("businessId") businessId: string): Promise<RecurringInvoiceSummary[]> {
    return this.recurring.list(businessId);
  }

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Body(new ZodValidationPipe(saveRecurringInvoiceSchema)) input: SaveRecurringInvoice,
  ): Promise<RecurringInvoice> {
    return this.recurring.create(userId, businessId, input);
  }

  @Get(":id")
  get(
    @Param("businessId") businessId: string,
    @Param("id", idPipe) id: string,
  ): Promise<RecurringInvoice> {
    return this.recurring.get(businessId, id);
  }

  @Put(":id")
  update(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Param("id", idPipe) id: string,
    @Body(new ZodValidationPipe(saveRecurringInvoiceSchema)) input: SaveRecurringInvoice,
  ): Promise<RecurringInvoice> {
    return this.recurring.update(userId, businessId, id, input);
  }

  @Post(":id/pause")
  @HttpCode(200)
  pause(@Param("businessId") businessId: string, @Param("id", idPipe) id: string) {
    return this.recurring.pause(businessId, id);
  }

  @Post(":id/resume")
  @HttpCode(200)
  resume(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Param("id", idPipe) id: string,
  ) {
    return this.recurring.resume(userId, businessId, id);
  }

  @Post(":id/skip")
  @HttpCode(200)
  skip(@Param("businessId") businessId: string, @Param("id", idPipe) id: string) {
    return this.recurring.skip(businessId, id);
  }

  @Post(":id/end")
  @HttpCode(200)
  end(@Param("businessId") businessId: string, @Param("id", idPipe) id: string) {
    return this.recurring.end(businessId, id);
  }
}
