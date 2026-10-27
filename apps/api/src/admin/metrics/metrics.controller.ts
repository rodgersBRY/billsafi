import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import {
  type AdminActivity,
  type AdminActivityQuery,
  adminActivityQuerySchema,
  type AdminAnalytics,
  type AdminFunnel,
  type AdminFunnelQuery,
  adminFunnelQuerySchema,
  type AdminOverview,
  type AdminRangeQuery,
  adminRangeQuerySchema,
  type AdminRetention,
  type AdminRetentionQuery,
  adminRetentionQuerySchema,
  type AdminTrends,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { ADMIN_CACHE, type TtlCache } from "../shared/ttl-cache.js";
import { AdminActivityService } from "./admin-activity.service.js";
import { AdminAnalyticsService } from "./admin-analytics.service.js";
import { AdminMetricsService } from "./admin-metrics.service.js";
import { AdminOverviewService } from "./admin-overview.service.js";

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
    private readonly overviews: AdminOverviewService,
    private readonly activities: AdminActivityService,
    private readonly analytics: AdminAnalyticsService,
    @Inject(ADMIN_CACHE) private readonly cache: TtlCache,
  ) {}

  /** KPIs for `range` with the previous period, definitions and the attention counts. */
  @Get("overview")
  overview(
    @Query(new ZodValidationPipe(adminRangeQuerySchema)) query: AdminRangeQuery,
  ): Promise<AdminOverview> {
    return this.cache.get(`overview:${query.range}`, () => this.overviews.overview(query.range));
  }

  @Get("overview/trends")
  trends(
    @Query(new ZodValidationPipe(adminRangeQuerySchema)) query: AdminRangeQuery,
  ): Promise<AdminTrends> {
    return this.cache.get(`overview-trends:${query.range}`, () =>
      this.overviews.trends(query.range),
    );
  }

  @Get("activity")
  activity(
    @Query(new ZodValidationPipe(adminActivityQuerySchema)) query: AdminActivityQuery,
  ): Promise<AdminActivity> {
    return this.cache.get(`activity:${query.limit}`, () => this.activities.activity(query.limit));
  }

  @Get("analytics")
  analyticsOverview(
    @Query(new ZodValidationPipe(adminRangeQuerySchema)) query: AdminRangeQuery,
  ): Promise<AdminAnalytics> {
    return this.cache.get(`analytics:${query.range}`, () => this.analytics.analytics(query.range));
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
