import { Global, Module } from "@nestjs/common";
import { SlidingWindowLimiter } from "../admin/shared/rate-limit.guard.js";
import { ActivityRecorder } from "./activity-recorder.js";
import {
  EVENT_INTAKE_LIMIT_PER_MINUTE,
  EVENT_INTAKE_LIMITER,
  EventsController,
} from "./events.controller.js";
import { MaintenanceJobs } from "./maintenance.jobs.js";
import { PruneService } from "./prune.service.js";

@Global()
@Module({
  controllers: [EventsController],
  providers: [
    ActivityRecorder,
    PruneService,
    MaintenanceJobs,
    {
      provide: EVENT_INTAKE_LIMITER,
      useFactory: () => new SlidingWindowLimiter(EVENT_INTAKE_LIMIT_PER_MINUTE, 60_000),
    },
  ],
  exports: [ActivityRecorder, PruneService],
})
export class ActivityModule {}
