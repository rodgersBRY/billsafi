import { Module } from "@nestjs/common";
import { BillingModule } from "../../billing/billing.module.js";
import { AdminSharedModule } from "../shared/admin-shared.module.js";
import { AdminBillingService } from "./admin-billing.service.js";
import { AdminSubscriptionActionsService } from "./admin-subscription-actions.service.js";
import { AdminSubscriptionsService } from "./admin-subscriptions.service.js";
import { SubscriptionActionsController } from "./subscription-actions.controller.js";
import { SubscriptionsController } from "./subscriptions.controller.js";

@Module({
  imports: [AdminSharedModule, BillingModule],
  controllers: [SubscriptionsController, SubscriptionActionsController],
  providers: [AdminSubscriptionsService, AdminSubscriptionActionsService, AdminBillingService],
  exports: [AdminSubscriptionsService, AdminBillingService],
})
export class AdminSubscriptionsModule {}
