import { Controller, Get, HttpCode, Inject, Param, Query, UseGuards } from "@nestjs/common";
import {
  type AdminAuditLogsQuery,
  adminAuditLogsQuerySchema,
  type AdminAuditPage,
  type AdminBilling,
  type AdminFunnel,
  type AdminFunnelQuery,
  type AdminGrantsPage,
  type AdminGrantsQuery,
  adminGrantsQuerySchema,
  type AdminOverridesPage,
  type AdminOverridesQuery,
  adminOverridesQuerySchema,
  type AdminPlanPaymentsPage,
  type AdminPlanPaymentsQuery,
  adminPlanPaymentsQuerySchema,
  type AdminSubscriptionsPage,
  type AdminSubscriptionsQuery,
  adminSubscriptionsQuerySchema,
  adminFunnelQuerySchema,
  type AdminOverview,
  type AdminRetention,
  type AdminRetentionQuery,
  adminRetentionQuerySchema,
  type AdminTenantDetail,
  type AdminTenantsPage,
  type AdminTenantsQuery,
  adminTenantsQuerySchema,
  type AdminUserDetail,
  type AdminUsersPage,
  type AdminUsersQuery,
  adminUsersQuerySchema,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminAuditService } from "./admin-audit.service.js";
import { AdminBillingService } from "./admin-billing.service.js";
import { AdminMetricsService } from "./admin-metrics.service.js";
import { AdminSubscriptionsService } from "./admin-subscriptions.service.js";
import { AdminTenantsService } from "./admin-tenants.service.js";
import { AdminUsersService } from "./admin-users.service.js";
import { AdminGuard } from "./admin.guard.js";
import { ADMIN_CACHE, type TtlCache } from "./ttl-cache.js";

/** The same filters in any order give the same key. */
function cacheKey(query: object): string {
  return JSON.stringify(Object.entries(query).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Admin read routes (GET only; actions live in AdminActionsController). Lists and metrics
 * are cached for 60 seconds per route and validated query, so page refreshes stay cheap;
 * any admin action clears the whole cache. Details and the audit log are not
 * cached, so they always show the latest state.
 */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly metrics: AdminMetricsService,
    private readonly users: AdminUsersService,
    private readonly tenants: AdminTenantsService,
    private readonly auditLogs: AdminAuditService,
    private readonly billingMetrics: AdminBillingService,
    private readonly subscriptions: AdminSubscriptionsService,
    @Inject(ADMIN_CACHE) private readonly cache: TtlCache,
  ) {}

  // Lets the web proxy answer a real 404 for /admin before rendering anything.
  @Get("access")
  @HttpCode(204)
  access(): void {
    // AdminGuard has already decided; there is nothing to send.
  }

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

  @Get("tenants")
  tenantList(
    @Query(new ZodValidationPipe(adminTenantsQuerySchema)) query: AdminTenantsQuery,
  ): Promise<AdminTenantsPage> {
    return this.cache.get(`tenants:${cacheKey(query)}`, () => this.tenants.list(query));
  }

  @Get("tenants/:id")
  tenant(@Param("id", new UuidParamPipe("Tenant")) id: string): Promise<AdminTenantDetail> {
    return this.tenants.detail(id);
  }

  @Get("users")
  userList(
    @Query(new ZodValidationPipe(adminUsersQuerySchema)) query: AdminUsersQuery,
  ): Promise<AdminUsersPage> {
    return this.cache.get(`users:${cacheKey(query)}`, () => this.users.list(query));
  }

  @Get("users/:id")
  user(@Param("id", new UuidParamPipe("User")) id: string): Promise<AdminUserDetail> {
    return this.users.detail(id);
  }

  @Get("audit-logs")
  auditLogList(
    @Query(new ZodValidationPipe(adminAuditLogsQuerySchema)) query: AdminAuditLogsQuery,
  ): Promise<AdminAuditPage> {
    return this.auditLogs.list(query);
  }

  @Get("billing")
  billing(): Promise<AdminBilling> {
    return this.cache.get("billing", () => this.billingMetrics.billing());
  }

  /** Accounts with their plan, who paid for this month, credits and overrides. */
  @Get("subscriptions")
  subscriptionList(
    @Query(new ZodValidationPipe(adminSubscriptionsQuerySchema)) query: AdminSubscriptionsQuery,
  ): Promise<AdminSubscriptionsPage> {
    return this.cache.get(`subscriptions:${cacheKey(query)}`, () =>
      this.subscriptions.subscriptions(query),
    );
  }

  /** Every plan payment, M-Pesa and manual. */
  @Get("subscription-payments")
  paymentList(
    @Query(new ZodValidationPipe(adminPlanPaymentsQuerySchema)) query: AdminPlanPaymentsQuery,
  ): Promise<AdminPlanPaymentsPage> {
    return this.cache.get(`subscription-payments:${cacheKey(query)}`, () =>
      this.subscriptions.payments(query),
    );
  }

  @Get("grants")
  grantList(
    @Query(new ZodValidationPipe(adminGrantsQuerySchema)) query: AdminGrantsQuery,
  ): Promise<AdminGrantsPage> {
    return this.cache.get(`grants:${cacheKey(query)}`, () => this.subscriptions.grants(query));
  }

  @Get("overrides")
  overrideList(
    @Query(new ZodValidationPipe(adminOverridesQuerySchema)) query: AdminOverridesQuery,
  ): Promise<AdminOverridesPage> {
    return this.cache.get(`overrides:${cacheKey(query)}`, () =>
      this.subscriptions.overrides(query),
    );
  }
}
