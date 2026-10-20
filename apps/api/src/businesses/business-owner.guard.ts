import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import type { AuthenticatedRequest } from "../common/current-user.js";
import { BusinessesService } from "./businesses.service.js";

const businessIdParam = z.uuid();

/** Allows the request only when :businessId belongs to the signed-in account. */
@Injectable()
export class BusinessOwnerGuard implements CanActivate {
  constructor(private readonly businesses: BusinessesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const parsed = businessIdParam.safeParse(request.params.businessId);
    if (!parsed.success) throw new NotFoundException("Business not found");
    await this.businesses.findOwned(request.user.id, parsed.data);
    return true;
  }
}
