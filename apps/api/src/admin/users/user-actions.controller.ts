import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import {
  type AdminActionAck,
  type AdminActionBody,
  adminActionBodySchema,
  type AdminUserRow,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { UuidParamPipe } from "../../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { type AdminActionRequest, actionContext } from "../shared/action-request.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { AdminActionRateLimitGuard } from "../shared/rate-limit.guard.js";
import { UserActionsService } from "./user-actions.service.js";

/** User actions that change data (POST only); same audit and rate limit as tenant actions. */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard, AdminActionRateLimitGuard)
@Controller("admin")
export class UserActionsController {
  constructor(private readonly actions: UserActionsService) {}

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
}
