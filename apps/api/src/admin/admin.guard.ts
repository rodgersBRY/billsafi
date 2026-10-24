import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import type { AuthenticatedRequest } from "../common/current-user.js";

type AdminRequest = Partial<AuthenticatedRequest> & { method: string; originalUrl: string };

/**
 * Lets only listed admin emails through. Everyone else, signed out included,
 * gets the same 404 as an unknown route so admin routes don't reveal themselves.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const email = request.user?.email?.toLowerCase();
    if (email && this.env.ADMIN_EMAILS.includes(email)) return true;
    // Same body Nest sends for a route that does not exist.
    throw new NotFoundException(`Cannot ${request.method} ${request.originalUrl}`);
  }
}
