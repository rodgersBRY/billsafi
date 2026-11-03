import { Module } from "@nestjs/common";
import { EmailPreferencesController } from "./email-preferences.controller.js";
import { ReengagementJobs } from "./reengagement.jobs.js";
import { ReengagementService } from "./reengagement.service.js";

@Module({
  controllers: [EmailPreferencesController],
  providers: [ReengagementService, ReengagementJobs],
  exports: [ReengagementService],
})
export class ReengagementModule {}
