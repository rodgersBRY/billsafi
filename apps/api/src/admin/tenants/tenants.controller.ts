import { Controller, Get, Inject, Param, Query, UseGuards } from "@nestjs/common";
import {
  type AdminTenantDetail,
  type AdminTenantsPage,
  type AdminTenantsQuery,
  adminTenantsQuerySchema,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { UuidParamPipe } from "../../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { cacheKey } from "../shared/cache-key.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { ADMIN_CACHE, type TtlCache } from "../shared/ttl-cache.js";
import { AdminTenantsService } from "./admin-tenants.service.js";

/** Tenant read routes. The list is cached for 60 seconds; the detail is not. */
// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class TenantsController {
  constructor(
    private readonly tenants: AdminTenantsService,
    @Inject(ADMIN_CACHE) private readonly cache: TtlCache,
  ) {}

  @Get("tenants")
  tenantList(
    @Query(new ZodValidationPipe(adminTenantsQuerySchema)) query: AdminTenantsQuery,
  ): Promise<AdminTenantsPage> {
    return this.cache.get(`tenants:${cacheKey(query)}`, () => this.tenants.list(query));
  }

  @Get("tenants/:id")
  tenant(@Param("id", new UuidParamPipe("Tenant")) id: string): Promise<AdminTenantDetail> {
    return this.tenants.detail(id);
  }
}
