import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import {
  type AdminActionBody,
  adminActionBodySchema,
  type AdminTenantRow,
  type AdminUserRow,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";
import type { AuthenticatedRequest } from "../common/current-user.js";
import type { RequestWithId } from "../common/request-id.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { type AdminActionContext, AdminActionsService } from "./admin-actions.service.js";
import { AdminGuard } from "./admin.guard.js";
import { AdminActionRateLimitGuard } from "./rate-limit.guard.js";

type AdminActionRequest = Request & Partial<RequestWithId> & AuthenticatedRequest;

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
  constructor(private readonly actions: AdminActionsService) {}

  /** Blocks sign-in and ends every session. Invoice links already sent keep working. */
  @Post("tenants/:id/suspend")
  @HttpCode(200)
  suspend(
    @Param("id", new UuidParamPipe("Tenant")) id: string,
    @Body(new ZodValidationPipe(adminActionBodySchema)) body: AdminActionBody,
    @Req() request: AdminActionRequest,
  ): Promise<AdminTenantRow> {
    return this.actions.suspendTenant(actionContext(request, body), id);
  }

  @Post("tenants/:id/reactivate")
  @HttpCode(200)
  reactivate(
    @Param("id", new UuidParamPipe("Tenant")) id: string,
    @Body(new ZodValidationPipe(adminActionBodySchema)) body: AdminActionBody,
    @Req() request: AdminActionRequest,
  ): Promise<AdminTenantRow> {
    return this.actions.reactivateTenant(actionContext(request, body), id);
  }

  /** Signs the user out everywhere without suspending them. */
  @Post("users/:id/revoke-sessions")
  @HttpCode(200)
  revokeSessions(
    @Param("id", new UuidParamPipe("User")) id: string,
    @Body(new ZodValidationPipe(adminActionBodySchema)) body: AdminActionBody,
    @Req() request: AdminActionRequest,
  ): Promise<AdminUserRow> {
    return this.actions.revokeSessions(actionContext(request, body), id);
  }
}
