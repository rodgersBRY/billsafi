import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module.js";
import { AccountAccessService } from "./account-access.service.js";
import { AdminActionsService } from "./admin-actions.service.js";
import { AdminAuditService } from "./admin-audit.service.js";
import { AdminBillingService } from "./admin-billing.service.js";
import { AdminMetricsService } from "./admin-metrics.service.js";
import { AdminRoleSyncService } from "./admin-role-sync.service.js";
import { AdminSubscriptionActionsService } from "./admin-subscription-actions.service.js";
import { AdminSubscriptionsService } from "./admin-subscriptions.service.js";
import { AdminTenantsService } from "./admin-tenants.service.js";
import { AdminUsersService } from "./admin-users.service.js";
import { AdminActionsController } from "./admin-actions.controller.js";
import { AdminController } from "./admin.controller.js";
import { ADMIN_ACTION_LIMITER, SlidingWindowLimiter } from "./rate-limit.guard.js";
import { ADMIN_CACHE, TtlCache } from "./ttl-cache.js";

@Module({
  imports: [BillingModule],
  controllers: [AdminController, AdminActionsController],
  providers: [
    AdminMetricsService,
    AdminUsersService,
    AdminTenantsService,
    AdminAuditService,
    AdminActionsService,
    AdminSubscriptionActionsService,
    AdminSubscriptionsService,
    AdminBillingService,
    AdminRoleSyncService,
    AccountAccessService,
    { provide: ADMIN_CACHE, useFactory: () => new TtlCache(60_000) },
    { provide: ADMIN_ACTION_LIMITER, useFactory: () => new SlidingWindowLimiter(10, 60_000) },
  ],
})
export class AdminModule {}
