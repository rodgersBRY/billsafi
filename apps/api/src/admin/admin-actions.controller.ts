import { Controller, UseGuards } from "@nestjs/common";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { AdminGuard } from "./admin.guard.js";
import { AdminActionRateLimitGuard } from "./rate-limit.guard.js";

/**
 * Admin actions that change data (POST only). Kept apart from the cached read routes:
 * every handler here takes a `reason` (adminActionBodySchema), writes an audit row for
 * success and failure, and is rate limited. Tenant and user actions arrive next.
 */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard, AdminActionRateLimitGuard)
@Controller("admin")
export class AdminActionsController {}
