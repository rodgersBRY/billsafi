import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module.js";
import { BusinessOwnerGuard } from "./business-owner.guard.js";
import { BusinessesController } from "./businesses.controller.js";
import { BusinessesService } from "./businesses.service.js";

@Module({
  imports: [BillingModule],
  controllers: [BusinessesController],
  providers: [BusinessesService, BusinessOwnerGuard],
  exports: [BusinessesService, BusinessOwnerGuard],
})
export class BusinessesModule {}
