import { Module } from "@nestjs/common";
import { AdminSharedModule } from "../shared/admin-shared.module.js";
import { AdminMetricsService } from "./admin-metrics.service.js";
import { MetricsController } from "./metrics.controller.js";

@Module({
  imports: [AdminSharedModule],
  controllers: [MetricsController],
  providers: [AdminMetricsService],
  exports: [AdminMetricsService],
})
export class MetricsModule {}
