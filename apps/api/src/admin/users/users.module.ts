import { Module } from "@nestjs/common";
import { AdminAuditModule } from "../audit/audit.module.js";
import { AdminSharedModule } from "../shared/admin-shared.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { AdminUsersService } from "./admin-users.service.js";
import { UserActionsController } from "./user-actions.controller.js";
import { UserActionsService } from "./user-actions.service.js";
import { UsersController } from "./users.controller.js";

@Module({
  imports: [AdminSharedModule, AdminAuditModule, TenantsModule],
  controllers: [UsersController, UserActionsController],
  providers: [AdminUsersService, UserActionsService],
  exports: [AdminUsersService],
})
export class UsersModule {}
