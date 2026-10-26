import { Controller, Get, UseGuards } from "@nestjs/common";
import type { AdminHealth } from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { AdminGuard } from "../shared/admin.guard.js";
import { AdminHealthService } from "./admin-health.service.js";

/** Not cached: the page's Refresh button should run the checks again. */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class AdminHealthController {
  constructor(private readonly health: AdminHealthService) {}

  @Get("health")
  check(): Promise<AdminHealth> {
    return this.health.health();
  }
}
