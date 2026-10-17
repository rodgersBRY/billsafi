import { Module } from "@nestjs/common";
import { BusinessesModule } from "../businesses/businesses.module.js";
import { AllowanceService } from "./allowance.service.js";
import { DashboardService } from "./dashboard.service.js";
import {
  DashboardController,
  InvoicesController,
  PublicInvoicesController,
  UsageController,
} from "./invoices.controller.js";
import { InvoicesService } from "./invoices.service.js";
import { LinksService } from "./links.service.js";
import { PaymentsService } from "./payments.service.js";
import { PdfService } from "./pdf.service.js";

@Module({
  imports: [BusinessesModule],
  controllers: [InvoicesController, DashboardController, UsageController, PublicInvoicesController],
  providers: [
    InvoicesService,
    AllowanceService,
    PaymentsService,
    LinksService,
    PdfService,
    DashboardService,
  ],
})
export class InvoicesModule {}
