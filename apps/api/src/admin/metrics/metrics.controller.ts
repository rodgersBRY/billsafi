import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import {
  type AdminFunnel,
  type AdminFunnelQuery,
  adminFunnelQuerySchema,
  type AdminOverview,
  type AdminRetention,
  type AdminRetentionQuery,
  adminRetentionQuerySchema,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { ADMIN_CACHE, type TtlCache } from "../shared/ttl-cache.js";
import { AdminMetricsService } from "./admin-metrics.service.js";

/**
 * Admin metrics routes (GET only). Cached for 60 seconds per route and validated query,
 * so page refreshes stay cheap; any admin action clears the whole cache.
 */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class MetricsController {
  constructor(
    private readonly metrics: AdminMetricsService,
    @Inject(ADMIN_CACHE) private readonly cache: TtlCache,
  ) {}

  @Get("overview")
  overview(): Promise<AdminOverview> {
    return this.cache.get("overview", () => this.metrics.overview());
  }

  @Get("funnel")
  funnel(
    @Query(new ZodValidationPipe(adminFunnelQuerySchema)) query: AdminFunnelQuery,
  ): Promise<AdminFunnel> {
    return this.cache.get(`funnel:${query.days}`, () => this.metrics.funnel(query.days));
  }

  @Get("retention")
  retention(
    @Query(new ZodValidationPipe(adminRetentionQuerySchema)) query: AdminRetentionQuery,
  ): Promise<AdminRetention> {
    return this.cache.get(`retention:${query.weeks}`, () => this.metrics.retention(query.weeks));
  }
}
