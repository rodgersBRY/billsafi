import { Module } from "@nestjs/common";
import { AdminSharedModule } from "../shared/admin-shared.module.js";
import { AccessController } from "./access.controller.js";
import { AdminRoleSyncService } from "./admin-role-sync.service.js";

@Module({
  imports: [AdminSharedModule],
  controllers: [AccessController],
  providers: [AdminRoleSyncService],
})
export class AccessModule {}
