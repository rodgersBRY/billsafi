import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import {
  type AdminSupportAccount,
  type AdminSupportCaseDetail,
  type AdminSupportCasesPage,
  type AdminSupportCasesQuery,
  adminSupportCasesQuerySchema,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { UuidParamPipe } from "../../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { AdminSupportService } from "./admin-support.service.js";

/** Support reads. Never cached: a case someone just changed must show at once. */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin/support")
export class SupportController {
  constructor(private readonly support: AdminSupportService) {}

  @Get("cases")
  list(
    @Query(new ZodValidationPipe(adminSupportCasesQuerySchema)) query: AdminSupportCasesQuery,
  ): Promise<AdminSupportCasesPage> {
    return this.support.list(query);
  }

  @Get("cases/:id")
  detail(@Param("id", new UuidParamPipe("Case")) id: string): Promise<AdminSupportCaseDetail> {
    return this.support.detail(id);
  }

  /** An account's cases and loose notes, for the tenant page. */
  @Get("accounts/:accountId")
  account(
    @Param("accountId", new UuidParamPipe("Account")) accountId: string,
  ): Promise<AdminSupportAccount> {
    return this.support.forAccount(accountId);
  }
}
