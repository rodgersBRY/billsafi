import { Module } from "@nestjs/common";
import { AdminSharedModule } from "../shared/admin-shared.module.js";
import { AdminActivityService } from "./admin-activity.service.js";
import { AdminAnalyticsService } from "./admin-analytics.service.js";
import { AdminMetricsService } from "./admin-metrics.service.js";
import { AdminOverviewService } from "./admin-overview.service.js";
import { MetricsController } from "./metrics.controller.js";

@Module({
  imports: [AdminSharedModule],
  controllers: [MetricsController],
  providers: [
    AdminMetricsService,
    AdminOverviewService,
    AdminActivityService,
    AdminAnalyticsService,
  ],
  exports: [AdminMetricsService],
})
export class MetricsModule {}
