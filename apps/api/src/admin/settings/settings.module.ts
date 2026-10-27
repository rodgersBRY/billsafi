import { Module } from "@nestjs/common";
import { PlatformModule } from "../../platform/platform.module.js";
import { AdminSharedModule } from "../shared/admin-shared.module.js";
import { AdminSettingsService } from "./admin-settings.service.js";
import { SettingsController } from "./settings.controller.js";

@Module({
  imports: [AdminSharedModule, PlatformModule],
  controllers: [SettingsController],
  providers: [AdminSettingsService],
})
export class AdminSettingsModule {}
