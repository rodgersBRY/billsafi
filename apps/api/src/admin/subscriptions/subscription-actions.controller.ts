import { Body, Controller, Headers, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import {
  type AdminActionBody,
  adminActionBodySchema,
  type AdminGrant,
  type AdminGrantRecorded,
  adminGrantSchema,
  type AdminOverride,
  type AdminOverrideResult,
  adminOverrideSchema,
  type AdminPaymentRecorded,
  type AdminProEnded,
  type AdminRecordPayment,
  adminRecordPaymentSchema,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { UuidParamPipe } from "../../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import {
  type AdminActionRequest,
  actionContext,
  idempotencyKey,
} from "../shared/action-request.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { AdminActionRateLimitGuard } from "../shared/rate-limit.guard.js";
import { AdminSubscriptionActionsService } from "./admin-subscription-actions.service.js";

/**
 * Payment, grant, Pro and override actions (POST only); same audit and rate limit as
 * tenant actions.
 */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard, AdminActionRateLimitGuard)
@Controller("admin")
export class SubscriptionActionsController {
  constructor(private readonly subscriptions: AdminSubscriptionActionsService) {}

  /**
   * Records a plan payment received outside M-Pesa checkout and applies it: Pro months
   * or credit packs. Send an Idempotency-Key header to make retries safe.
   */
  @Post("tenants/:id/payments")
  recordPayment(
    @Param("id", new UuidParamPipe("Tenant")) id: string,
    @Body(new ZodValidationPipe(adminRecordPaymentSchema)) body: AdminRecordPayment,
    @Headers("idempotency-key") key: string | undefined,
    @Req() request: AdminActionRequest,
  ): Promise<AdminPaymentRecorded> {
    return this.subscriptions.recordPayment(
      actionContext(request, body),
      id,
      body,
      idempotencyKey(key),
    );
  }

  /** Gives Pro months or invoice credits at no charge. Accepts an Idempotency-Key header. */
  @Post("tenants/:id/grants")
  grant(
    @Param("id", new UuidParamPipe("Tenant")) id: string,
    @Body(new ZodValidationPipe(adminGrantSchema)) body: AdminGrant,
    @Headers("idempotency-key") key: string | undefined,
    @Req() request: AdminActionRequest,
  ): Promise<AdminGrantRecorded> {
    return this.subscriptions.grant(actionContext(request, body), id, body, idempotencyKey(key));
  }

  /** Ends Pro at the end of the current Pro month; the months after it are dropped. */
  @Post("tenants/:id/end-pro")
  @HttpCode(200)
  endPro(
    @Param("id", new UuidParamPipe("Tenant")) id: string,
    @Body(new ZodValidationPipe(adminActionBodySchema)) body: AdminActionBody,
    @Req() request: AdminActionRequest,
  ): Promise<AdminProEnded> {
    return this.subscriptions.endPro(actionContext(request, body), id);
  }

  /** Raises the account's invoice limit until an expiry at most a year away. */
  @Post("tenants/:id/overrides")
  addOverride(
    @Param("id", new UuidParamPipe("Tenant")) id: string,
    @Body(new ZodValidationPipe(adminOverrideSchema)) body: AdminOverride,
    @Req() request: AdminActionRequest,
  ): Promise<AdminOverrideResult> {
    return this.subscriptions.addOverride(actionContext(request, body), id, body);
  }

  @Post("overrides/:id/revoke")
  @HttpCode(200)
  revokeOverride(
    @Param("id", new UuidParamPipe("Override")) id: string,
    @Body(new ZodValidationPipe(adminActionBodySchema)) body: AdminActionBody,
    @Req() request: AdminActionRequest,
  ): Promise<AdminOverrideResult> {
    return this.subscriptions.revokeOverride(actionContext(request, body), id);
  }
}
