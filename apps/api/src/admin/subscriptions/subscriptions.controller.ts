import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import {
  type AdminBilling,
  type AdminBillingQuery,
  adminBillingQuerySchema,
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
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { cacheKey } from "../shared/cache-key.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { ADMIN_CACHE, type TtlCache } from "../shared/ttl-cache.js";
import { AdminBillingService } from "./admin-billing.service.js";
import { AdminSubscriptionsService } from "./admin-subscriptions.service.js";

/** Billing and subscription read routes (GET only), cached for 60 seconds. */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class SubscriptionsController {
  constructor(
    private readonly billingMetrics: AdminBillingService,
    private readonly subscriptions: AdminSubscriptionsService,
    @Inject(ADMIN_CACHE) private readonly cache: TtlCache,
  ) {}

  @Get("billing")
  billing(
    @Query(new ZodValidationPipe(adminBillingQuerySchema)) query: AdminBillingQuery,
  ): Promise<AdminBilling> {
    return this.cache.get(`billing:${cacheKey(query)}`, () =>
      this.billingMetrics.billing(query.limitHits),
    );
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
