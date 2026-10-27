import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import {
  type AdminFailedSignInsPage,
  type AdminFailedSignInsQuery,
  adminFailedSignInsQuerySchema,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { cacheKey } from "../shared/cache-key.js";
import { ADMIN_CACHE, type TtlCache } from "../shared/ttl-cache.js";
import { AdminFailedSignInsService } from "./admin-failed-sign-ins.service.js";

/** Cached for 60 seconds per validated query, like the other admin lists. */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class SecurityController {
  constructor(
    private readonly failedSignIns: AdminFailedSignInsService,
    @Inject(ADMIN_CACHE) private readonly cache: TtlCache,
  ) {}

  @Get("security/failed-sign-ins")
  failedSignInList(
    @Query(new ZodValidationPipe(adminFailedSignInsQuerySchema)) query: AdminFailedSignInsQuery,
  ): Promise<AdminFailedSignInsPage> {
    return this.cache.get(`failed-sign-ins:${cacheKey(query)}`, () =>
      this.failedSignIns.list(query),
    );
  }
}
