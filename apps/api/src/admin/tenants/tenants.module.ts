import { Module } from "@nestjs/common";
import { BillingModule } from "../../billing/billing.module.js";
import { AdminAuditModule } from "../audit/audit.module.js";
import { AdminSharedModule } from "../shared/admin-shared.module.js";
import { AdminSubscriptionsModule } from "../subscriptions/subscriptions.module.js";
import { AccountAccessService } from "./account-access.service.js";
import { AdminTenantsService } from "./admin-tenants.service.js";
import { TenantActionsController } from "./tenant-actions.controller.js";
import { TenantActionsService } from "./tenant-actions.service.js";
import { TenantsController } from "./tenants.controller.js";

@Module({
  imports: [AdminSharedModule, AdminAuditModule, AdminSubscriptionsModule, BillingModule],
  controllers: [TenantsController, TenantActionsController],
  providers: [AdminTenantsService, TenantActionsService, AccountAccessService],
  exports: [AdminTenantsService, AccountAccessService],
})
export class TenantsModule {}
