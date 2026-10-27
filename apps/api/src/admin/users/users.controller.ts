import { Controller, Get, Inject, Param, Query, UseGuards } from "@nestjs/common";
import {
  type AdminUserDetail,
  type AdminUsersPage,
  type AdminUsersQuery,
  adminUsersQuerySchema,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { UuidParamPipe } from "../../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { cacheKey } from "../shared/cache-key.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { ADMIN_CACHE, type TtlCache } from "../shared/ttl-cache.js";
import { AdminUsersService } from "./admin-users.service.js";

/** User read routes. The list is cached for 60 seconds; the detail is not. */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class UsersController {
  constructor(
    private readonly users: AdminUsersService,
    @Inject(ADMIN_CACHE) private readonly cache: TtlCache,
  ) {}

  @Get("users")
  userList(
    @Query(new ZodValidationPipe(adminUsersQuerySchema)) query: AdminUsersQuery,
  ): Promise<AdminUsersPage> {
    return this.cache.get(`users:${cacheKey(query)}`, () => this.users.list(query));
  }

  @Get("users/:id")
  user(@Param("id", new UuidParamPipe("User")) id: string): Promise<AdminUserDetail> {
    return this.users.detail(id);
  }
}
