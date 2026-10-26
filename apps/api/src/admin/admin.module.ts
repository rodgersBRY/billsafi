import { Module } from "@nestjs/common";
import { AccessModule } from "./access/access.module.js";
import { AdminAuditModule } from "./audit/audit.module.js";
import { AdminHealthModule } from "./health/health.module.js";
import { MetricsModule } from "./metrics/metrics.module.js";
import { AdminSharedModule } from "./shared/admin-shared.module.js";
import { AdminSubscriptionsModule } from "./subscriptions/subscriptions.module.js";
import { AdminSettingsModule } from "./settings/settings.module.js";
import { SupportModule } from "./support/support.module.js";
import { TenantsModule } from "./tenants/tenants.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    AdminSharedModule,
    AccessModule,
    MetricsModule,
    TenantsModule,
    UsersModule,
    AdminAuditModule,
    AdminSubscriptionsModule,
    AdminHealthModule,
    SupportModule,
    AdminSettingsModule,
  ],
})
export class AdminModule {}
