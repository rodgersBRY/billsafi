import { Controller, Get, Inject, Param, Query, UseGuards } from "@nestjs/common";
import {
  type AdminBilling,
  type AdminFunnel,
  type AdminFunnelQuery,
  adminFunnelQuerySchema,
  type AdminOverview,
  type AdminRetention,
  type AdminRetentionQuery,
  adminRetentionQuerySchema,
  type AdminUserDetail,
  type AdminUsersPage,
  type AdminUsersQuery,
  adminUsersQuerySchema,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminBillingService } from "./admin-billing.service.js";
import { AdminMetricsService } from "./admin-metrics.service.js";
import { AdminUsersService } from "./admin-users.service.js";
import { AdminGuard } from "./admin.guard.js";
import { ADMIN_CACHE, type TtlCache } from "./ttl-cache.js";

/**
 * Read-only admin dashboard data. Everything except user detail is cached for
 * 60 seconds per route and validated query, so page refreshes stay cheap.
 */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly metrics: AdminMetricsService,
    private readonly users: AdminUsersService,
    private readonly billingMetrics: AdminBillingService,
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

  @Get("users")
  list(
    @Query(new ZodValidationPipe(adminUsersQuerySchema)) query: AdminUsersQuery,
  ): Promise<AdminUsersPage> {
    const key = `users:${JSON.stringify([query.page, query.search ?? null])}`;
    return this.cache.get(key, () => this.users.list(query));
  }

  // Not cached: opening one user should always show their latest state.
  @Get("users/:id")
  user(@Param("id", new UuidParamPipe("User")) id: string): Promise<AdminUserDetail> {
    return this.users.detail(id);
  }

  @Get("billing")
  billing(): Promise<AdminBilling> {
    return this.cache.get("billing", () => this.billingMetrics.billing());
  }
}
