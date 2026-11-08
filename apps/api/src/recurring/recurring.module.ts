import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module.js";
import { BusinessesModule } from "../businesses/businesses.module.js";
import { InvoicesModule } from "../invoices/invoices.module.js";
import { SavedItemsModule } from "../items/saved-items.module.js";
import { RecurringRunner } from "./recurring-runner.service.js";
import { RecurringController } from "./recurring.controller.js";
import { RecurringJobs } from "./recurring.jobs.js";
import { RecurringService } from "./recurring.service.js";

@Module({
  imports: [BusinessesModule, BillingModule, SavedItemsModule, InvoicesModule],
  controllers: [RecurringController],
  providers: [RecurringService, RecurringRunner, RecurringJobs],
  exports: [RecurringRunner],
})
export class RecurringModule {}
