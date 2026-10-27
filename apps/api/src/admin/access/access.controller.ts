import { Controller, Get, HttpCode, UseGuards } from "@nestjs/common";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { AdminGuard } from "../shared/admin.guard.js";

// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class AccessController {
  // Lets the web proxy answer a real 404 for /admin before rendering anything.
  @Get("access")
  @HttpCode(204)
  access(): void {
    // AdminGuard has already decided; there is nothing to send.
  }
}
