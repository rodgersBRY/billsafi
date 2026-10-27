import { Module } from "@nestjs/common";
import { AdminAuditModule } from "../audit/audit.module.js";
import { AdminSharedModule } from "../shared/admin-shared.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { AdminSupportService } from "./admin-support.service.js";
import { SupportActionsController } from "./support-actions.controller.js";
import { SupportActionsService } from "./support-actions.service.js";
import { SupportController } from "./support.controller.js";

@Module({
  imports: [AdminSharedModule, AdminAuditModule, TenantsModule],
  controllers: [SupportController, SupportActionsController],
  providers: [AdminSupportService, SupportActionsService],
})
export class SupportModule {}
