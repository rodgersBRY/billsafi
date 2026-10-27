import { Module } from "@nestjs/common";
import { AdminSharedModule } from "../shared/admin-shared.module.js";
import { AdminAuditService } from "./admin-audit.service.js";
import { AuditLogsController } from "./audit-logs.controller.js";

@Module({
  imports: [AdminSharedModule],
  controllers: [AuditLogsController],
  providers: [AdminAuditService],
  exports: [AdminAuditService],
})
export class AdminAuditModule {}
