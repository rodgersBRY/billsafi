import { Body, Controller, Post } from "@nestjs/common";
import {
  type ImportGuestInvoice,
  type ImportGuestInvoiceResult,
  importGuestInvoiceSchema,
} from "@billsafi/contracts";
import { CurrentUserId } from "../common/current-user.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { GuestInvoicesService } from "./guest-invoices.service.js";

@Controller("guest-invoices")
export class GuestInvoicesController {
  constructor(private readonly guestInvoices: GuestInvoicesService) {}

  @Post("import")
  import(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(importGuestInvoiceSchema)) input: ImportGuestInvoice,
  ): Promise<ImportGuestInvoiceResult> {
    return this.guestInvoices.import(userId, input);
  }
}
