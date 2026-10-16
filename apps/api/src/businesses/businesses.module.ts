import { Module } from "@nestjs/common";
import { BusinessOwnerGuard } from "./business-owner.guard.js";
import { BusinessesController } from "./businesses.controller.js";
import { BusinessesService } from "./businesses.service.js";

@Module({
  controllers: [BusinessesController],
  providers: [BusinessesService, BusinessOwnerGuard],
  exports: [BusinessesService, BusinessOwnerGuard],
})
export class BusinessesModule {}
