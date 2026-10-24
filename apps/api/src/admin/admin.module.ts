import { Module } from "@nestjs/common";
import { AccountAccessService } from "./account-access.service.js";
import { AdminBillingService } from "./admin-billing.service.js";
import { AdminMetricsService } from "./admin-metrics.service.js";
import { AdminRoleSyncService } from "./admin-role-sync.service.js";
import { AdminUsersService } from "./admin-users.service.js";
import { AdminController } from "./admin.controller.js";
import { ADMIN_CACHE, TtlCache } from "./ttl-cache.js";

@Module({
  controllers: [AdminController],
  providers: [
    AdminMetricsService,
    AdminUsersService,
    AdminBillingService,
    AdminRoleSyncService,
    AccountAccessService,
    { provide: ADMIN_CACHE, useFactory: () => new TtlCache(60_000) },
  ],
})
export class AdminModule {}
