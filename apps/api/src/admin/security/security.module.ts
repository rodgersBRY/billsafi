import { Module } from "@nestjs/common";
import { AdminSharedModule } from "../shared/admin-shared.module.js";
import { AdminFailedSignInsService } from "./admin-failed-sign-ins.service.js";
import { SecurityController } from "./security.controller.js";

@Module({
  imports: [AdminSharedModule],
  controllers: [SecurityController],
  providers: [AdminFailedSignInsService],
})
export class AdminSecurityModule {}
