import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module.js";
import { BusinessesModule } from "../businesses/businesses.module.js";
import { SavedItemsController } from "./saved-items.controller.js";
import { SavedItemsService } from "./saved-items.service.js";

@Module({
  imports: [BusinessesModule, BillingModule],
  controllers: [SavedItemsController],
  providers: [SavedItemsService],
  exports: [SavedItemsService],
})
export class SavedItemsModule {}
