import { Module } from "@nestjs/common";
import { AdminSharedModule } from "../shared/admin-shared.module.js";
import { AdminWhatsNewController } from "./admin-whats-new.controller.js";
import { AdminWhatsNewService } from "./admin-whats-new.service.js";

@Module({
  imports: [AdminSharedModule],
  controllers: [AdminWhatsNewController],
  providers: [AdminWhatsNewService],
})
export class AdminWhatsNewModule {}
