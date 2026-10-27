import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type DatabaseConnection, eq, schema } from "@billsafi/db";
import type { AuthenticatedRequest } from "../../common/current-user.js";
import { DATABASE } from "../../database/database.module.js";

type AdminRequest = Partial<AuthenticatedRequest> & { method: string; originalUrl: string };

/**
 * Lets only users whose role is "admin" and who are not suspended through. Everyone else, signed out included,
 * gets the same 404 as an unknown route so admin routes don't reveal themselves.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const id = request.user?.id;
    // Read from the table, not the session object, so a demotion applies on the very next
    // request even if session caching is turned on later.
    if (id) {
      const [user] = await this.connection.db
        .select({ role: schema.users.role, banned: schema.users.banned })
        .from(schema.users)
        .where(eq(schema.users.id, id));
      // A suspended admin is locked out like anyone else.
      if (user?.role === "admin" && !user.banned) return true;
    }
    // Same body Nest sends for a route that does not exist.
    throw new NotFoundException(`Cannot ${request.method} ${request.originalUrl}`);
  }
}
