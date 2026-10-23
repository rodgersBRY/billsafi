import { Module } from "@nestjs/common";
import { AuthProvidersController } from "./auth-providers.controller.js";

@Module({
  controllers: [AuthProvidersController],
})
export class AuthProvidersModule {}
