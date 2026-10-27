import { Module } from "@nestjs/common";
import { TtlCache } from "../admin/shared/ttl-cache.js";
import { PLATFORM_CACHE } from "./platform-cache.js";
import { PlatformController } from "./platform.controller.js";

@Module({
  controllers: [PlatformController],
  providers: [{ provide: PLATFORM_CACHE, useFactory: () => new TtlCache(30_000) }],
  exports: [PLATFORM_CACHE],
})
export class PlatformModule {}
