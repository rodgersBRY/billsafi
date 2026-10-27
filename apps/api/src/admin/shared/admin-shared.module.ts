import { Module } from "@nestjs/common";
import { AdminActionRunner } from "./admin-action-runner.js";
import { AdminGuard } from "./admin.guard.js";
import {
  ADMIN_ACTION_LIMITER,
  AdminActionRateLimitGuard,
  SlidingWindowLimiter,
} from "./rate-limit.guard.js";
import { ADMIN_CACHE, TtlCache } from "./ttl-cache.js";

/**
 * The pieces every admin feature shares. Declared once here so there is a single cache,
 * a single rate limiter and a single action runner per process.
 */
@Module({
  providers: [
    AdminGuard,
    AdminActionRateLimitGuard,
    AdminActionRunner,
    { provide: ADMIN_CACHE, useFactory: () => new TtlCache(60_000) },
    { provide: ADMIN_ACTION_LIMITER, useFactory: () => new SlidingWindowLimiter(10, 60_000) },
  ],
  exports: [
    AdminGuard,
    AdminActionRateLimitGuard,
    AdminActionRunner,
    ADMIN_CACHE,
    ADMIN_ACTION_LIMITER,
  ],
})
export class AdminSharedModule {}
