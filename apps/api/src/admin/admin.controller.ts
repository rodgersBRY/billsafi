import { Controller, Get, UseGuards } from "@nestjs/common";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { AdminGuard } from "./admin.guard.js";

// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  // Temporary route to exercise the guard; later steps replace it.
  @Get("ping")
  ping() {
    return { ok: true };
  }
}
