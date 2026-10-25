import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  type AdminActionAck,
  type AdminActionBody,
  adminActionBodySchema,
  type AdminGrant,
  type AdminGrantRecorded,
  adminGrantSchema,
  type AdminPaymentRecorded,
  type AdminProEnded,
  type AdminRecordPayment,
  adminRecordPaymentSchema,
  type AdminTenantRow,
  type AdminUserRow,
  idempotencyKeySchema,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";
import type { AuthenticatedRequest } from "../common/current-user.js";
import type { RequestWithId } from "../common/request-id.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { type AdminActionContext, AdminActionsService } from "./admin-actions.service.js";
import { AdminSubscriptionActionsService } from "./admin-subscription-actions.service.js";
import { AdminGuard } from "./admin.guard.js";
import { AdminActionRateLimitGuard } from "./rate-limit.guard.js";

type AdminActionRequest = Request & Partial<RequestWithId> & AuthenticatedRequest;

/** The optional Idempotency-Key header; 400 when it is sent but blank or too long. */
function idempotencyKey(header: string | string[] | undefined): string | undefined {
  if (header === undefined) return undefined;
  const parsed = idempotencyKeySchema.safeParse(Array.isArray(header) ? header.join(",") : header);
  if (!parsed.success) {
    throw new BadRequestException({
      message: "Validation failed",
      issues: [{ path: "Idempotency-Key", message: parsed.error.issues[0]!.message }],
    });
  }
  return parsed.data;
}

function actionContext(request: AdminActionRequest, body: AdminActionBody): AdminActionContext {
  return {
    // AdminGuard has already required a signed-in admin.
    adminId: request.user.id,
    reason: body.reason,
    request: { requestId: request.requestId, ip: request.ip },
  };
}

/**
 * Admin actions that change data (POST only). Kept apart from the cached read routes:
 * every handler here takes a `reason` (adminActionBodySchema), writes an audit row for
 * success and failure, and is rate limited to 10 a minute per admin.
 */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard, AdminActionRateLimitGuard)
@Controller("admin")
export class AdminActionsController {
  constructor(
    private readonly actions: AdminActionsService,
    private readonly subscriptions: AdminSubscriptionActionsService,
  ) {}

  /** Blocks sign-in and ends every session. Invoice links already sent keep working. */
  @Post("tenants/:id/suspend")
  @HttpCode(200)
  suspend(
    @Param("id", new UuidParamPipe("Tenant")) id: string,
    @Body(new ZodValidationPipe(adminActionBodySchema)) body: AdminActionBody,
    @Req() request: AdminActionRequest,
  ): Promise<AdminTenantRow | AdminActionAck> {
    return this.actions.suspendTenant(actionContext(request, body), id);
  }

  @Post("tenants/:id/reactivate")
  @HttpCode(200)
  reactivate(
    @Param("id", new UuidParamPipe("Tenant")) id: string,
    @Body(new ZodValidationPipe(adminActionBodySchema)) body: AdminActionBody,
    @Req() request: AdminActionRequest,
  ): Promise<AdminTenantRow | AdminActionAck> {
    return this.actions.reactivateTenant(actionContext(request, body), id);
  }

  /** Signs the user out everywhere without suspending them. */
  @Post("users/:id/revoke-sessions")
  @HttpCode(200)
  revokeSessions(
    @Param("id", new UuidParamPipe("User")) id: string,
    @Body(new ZodValidationPipe(adminActionBodySchema)) body: AdminActionBody,
    @Req() request: AdminActionRequest,
  ): Promise<AdminUserRow | AdminActionAck> {
    return this.actions.revokeSessions(actionContext(request, body), id);
  }

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
}
