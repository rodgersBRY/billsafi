import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import {
  type AdminActionAck,
  type AdminActionBody,
  adminActionBodySchema,
  type AdminTenantRow,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { UuidParamPipe } from "../../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { type AdminActionRequest, actionContext } from "../shared/action-request.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { AdminActionRateLimitGuard } from "../shared/rate-limit.guard.js";
import { TenantActionsService } from "./tenant-actions.service.js";

/**
 * Tenant actions that change data (POST only). Every handler takes a `reason`
 * (adminActionBodySchema), writes an audit row for success and failure, and is rate
 * limited to 10 a minute per admin.
 */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard, AdminActionRateLimitGuard)
@Controller("admin")
export class TenantActionsController {
  constructor(private readonly actions: TenantActionsService) {}

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
}
