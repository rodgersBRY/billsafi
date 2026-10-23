import { Module } from "@nestjs/common";
import { BusinessesModule } from "../businesses/businesses.module.js";
import { BillingModule } from "../billing/billing.module.js";
import { BrandingService } from "./branding.service.js";
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
  imports: [BusinessesModule, BillingModule],
  controllers: [InvoicesController, DashboardController, UsageController, PublicInvoicesController],
  providers: [
    InvoicesService,
    PaymentsService,
    LinksService,
    PdfService,
    BrandingService,
    DashboardService,
  ],
  exports: [InvoicesService],
})
export class InvoicesModule {}
