import { Body, Controller, HttpCode, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import {
  type AdminActionBody,
  adminActionBodySchema,
  type AdminSupportCaseCreate,
  adminSupportCaseCreateSchema,
  type AdminSupportCaseResult,
  type AdminSupportCaseUpdate,
  adminSupportCaseUpdateSchema,
  type AdminSupportNoteCreate,
  adminSupportNoteCreateSchema,
  type AdminSupportNoteResult,
  type AdminSupportResolve,
  adminSupportResolveSchema,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { UuidParamPipe } from "../../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { type AdminActionRequest, actionContext } from "../shared/action-request.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { AdminActionRateLimitGuard } from "../shared/rate-limit.guard.js";
import { SupportActionsService } from "./support-actions.service.js";

/** Support writes: audited, rate limited, and answered with the fresh case row. */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard, AdminActionRateLimitGuard)
@Controller("admin/support")
export class SupportActionsController {
  constructor(private readonly actions: SupportActionsService) {}

  @Post("cases")
  create(
    @Body(new ZodValidationPipe(adminSupportCaseCreateSchema)) body: AdminSupportCaseCreate,
    @Req() request: AdminActionRequest,
  ): Promise<AdminSupportCaseResult> {
    return this.actions.create(actionContext(request, body), body);
  }

  @Patch("cases/:id")
  update(
    @Param("id", new UuidParamPipe("Case")) id: string,
    @Body(new ZodValidationPipe(adminSupportCaseUpdateSchema)) body: AdminSupportCaseUpdate,
    @Req() request: AdminActionRequest,
  ): Promise<AdminSupportCaseResult> {
    return this.actions.update(actionContext(request, body), id, body);
  }

  @Post("cases/:id/resolve")
  @HttpCode(200)
  resolve(
    @Param("id", new UuidParamPipe("Case")) id: string,
    @Body(new ZodValidationPipe(adminSupportResolveSchema)) body: AdminSupportResolve,
    @Req() request: AdminActionRequest,
  ): Promise<AdminSupportCaseResult> {
    return this.actions.resolve(actionContext(request, body), id, body);
  }

  @Post("cases/:id/reopen")
  @HttpCode(200)
  reopen(
    @Param("id", new UuidParamPipe("Case")) id: string,
    @Body(new ZodValidationPipe(adminActionBodySchema)) body: AdminActionBody,
    @Req() request: AdminActionRequest,
  ): Promise<AdminSupportCaseResult> {
    return this.actions.reopen(actionContext(request, body), id);
  }

  @Post("cases/:id/notes")
  addCaseNote(
    @Param("id", new UuidParamPipe("Case")) id: string,
    @Body(new ZodValidationPipe(adminSupportNoteCreateSchema)) body: AdminSupportNoteCreate,
    @Req() request: AdminActionRequest,
  ): Promise<AdminSupportNoteResult> {
    return this.actions.addNote(
      actionContext(request, { reason: body.reason ?? "Internal note" }),
      { caseId: id },
      body.body,
    );
  }

  /** A loose note on the account, with no case. */
  @Post("accounts/:accountId/notes")
  addAccountNote(
    @Param("accountId", new UuidParamPipe("Account")) accountId: string,
    @Body(new ZodValidationPipe(adminSupportNoteCreateSchema)) body: AdminSupportNoteCreate,
    @Req() request: AdminActionRequest,
  ): Promise<AdminSupportNoteResult> {
    return this.actions.addNote(
      actionContext(request, { reason: body.reason ?? "Internal note" }),
      { accountId },
      body.body,
    );
  }
}
