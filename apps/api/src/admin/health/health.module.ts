import { Module } from "@nestjs/common";
import type { DatabaseConnection } from "@billsafi/db";
import { DATABASE } from "../../database/database.module.js";
import { AdminSharedModule } from "../shared/admin-shared.module.js";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { AdminFailuresService } from "./admin-failures.service.js";
import { BackupsHealthProvider } from "./backups-health.provider.js";
import { BillingJobsHealthProvider } from "./billing-jobs-health.provider.js";
import { PdfEmailHealthProvider } from "./pdf-email-health.provider.js";
import { AdminHealthService } from "./admin-health.service.js";
import { DatabaseHealthProvider } from "./database-health.provider.js";
import { AdminHealthController } from "./health.controller.js";
import { HEALTH_INDICATOR_PROVIDERS } from "./health-provider.js";
import { MigrationsHealthProvider } from "./migrations-health.provider.js";
import { MpesaHealthProvider } from "./mpesa-health.provider.js";

@Module({
  imports: [AdminSharedModule],
  controllers: [AdminHealthController],
  providers: [
    AdminHealthService,
    AdminFailuresService,
    {
      // The registry, in display order. Billing jobs, PDF and email failures and backups
      // read what phase 5 records (D066).
      provide: HEALTH_INDICATOR_PROVIDERS,
      inject: [DATABASE, ENV],
      useFactory: (connection: DatabaseConnection, env: Pick<Env, "BILLING_JOBS">) => [
        new DatabaseHealthProvider(connection),
        new MigrationsHealthProvider(connection),
        new MpesaHealthProvider(connection),
        new BillingJobsHealthProvider(connection, env.BILLING_JOBS),
        new PdfEmailHealthProvider(connection),
        new BackupsHealthProvider(connection),
      ],
    },
  ],
})
export class AdminHealthModule {}
