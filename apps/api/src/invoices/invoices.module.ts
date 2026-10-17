import { Module } from "@nestjs/common";
import { BusinessesModule } from "../businesses/businesses.module.js";
import { AllowanceService } from "./allowance.service.js";
import { InvoicesController, UsageController } from "./invoices.controller.js";
import { InvoicesService } from "./invoices.service.js";

@Module({
  imports: [BusinessesModule],
  controllers: [InvoicesController, UsageController],
  providers: [InvoicesService, AllowanceService],
})
export class InvoicesModule {}
