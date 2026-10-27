import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  type AdminFailuresPage,
  type AdminFailuresQuery,
  adminFailuresQuerySchema,
  type AdminHealth,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { AdminFailuresService } from "./admin-failures.service.js";
import { AdminHealthService } from "./admin-health.service.js";

/** Not cached: the page's Refresh button should run the checks again. */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class AdminHealthController {
  constructor(
    private readonly health: AdminHealthService,
    private readonly failures: AdminFailuresService,
  ) {}

  @Get("health")
  check(): Promise<AdminHealth> {
    return this.health.health();
  }

  /** The recent PDF, email and job failures behind the Health indicator. Not cached either. */
  @Get("health/failures")
  recentFailures(
    @Query(new ZodValidationPipe(adminFailuresQuerySchema)) query: AdminFailuresQuery,
  ): Promise<AdminFailuresPage> {
    return this.failures.failures(query);
  }
}
