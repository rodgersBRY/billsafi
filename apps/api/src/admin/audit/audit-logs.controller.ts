import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  type AdminAuditLogsQuery,
  adminAuditLogsQuerySchema,
  type AdminAuditPage,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { AdminAuditService } from "./admin-audit.service.js";

/** The audit log is not cached, so it always shows the latest state. */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class AuditLogsController {
  constructor(private readonly auditLogs: AdminAuditService) {}

  @Get("audit-logs")
  auditLogList(
    @Query(new ZodValidationPipe(adminAuditLogsQuerySchema)) query: AdminAuditLogsQuery,
  ): Promise<AdminAuditPage> {
    return this.auditLogs.list(query);
  }
}
