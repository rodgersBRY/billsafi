import { Module } from "@nestjs/common";
import type { DatabaseConnection } from "@billsafi/db";
import { DATABASE } from "../../database/database.module.js";
import { AdminSharedModule } from "../shared/admin-shared.module.js";
import { AdminHealthService } from "./admin-health.service.js";
import { DatabaseHealthProvider } from "./database-health.provider.js";
import { AdminHealthController } from "./health.controller.js";
import { HEALTH_INDICATOR_PROVIDERS } from "./health-provider.js";
import { MigrationsHealthProvider } from "./migrations-health.provider.js";
import { MpesaHealthProvider } from "./mpesa-health.provider.js";
import { UnrecordedHealthProvider } from "./unrecorded-health.provider.js";

@Module({
  imports: [AdminSharedModule],
  controllers: [AdminHealthController],
  providers: [
    AdminHealthService,
    {
      // The registry, in display order. Phase 5 swaps the three unrecorded entries for
      // providers that read job heartbeats, failure records and backup status.
      provide: HEALTH_INDICATOR_PROVIDERS,
      inject: [DATABASE],
      useFactory: (connection: DatabaseConnection) => [
        new DatabaseHealthProvider(connection),
        new MigrationsHealthProvider(connection),
        new MpesaHealthProvider(connection),
        new UnrecordedHealthProvider(
          "billing_jobs",
          "Billing jobs",
          "Not recorded",
          "Job runs aren't recorded yet. When they are, this shows the last run of each billing job.",
        ),
        new UnrecordedHealthProvider(
          "pdf_email",
          "PDF and email failures",
          "Not recorded",
          "PDF and email failures aren't recorded yet. When they are, this shows how many failed recently.",
        ),
        new UnrecordedHealthProvider(
          "backups",
          "Backups",
          "Not recorded",
          "Backups aren't reported to the API yet. When they are, this shows the last good backup.",
        ),
      ],
    },
  ],
})
export class AdminHealthModule {}
