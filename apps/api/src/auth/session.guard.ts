import { type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@thallesp/nestjs-better-auth";

type SessionRequest = {
  user?: { banned?: boolean | null } | null;
  session?: unknown;
};

/**
 * Better Auth's global guard plus one rule: a suspended account counts as signed out on
 * every request. Suspending deletes sessions, but if a deletion failed or a session was
 * made some other way, this keeps it useless. getSession reads the user from the database
 * on each request (no cookie cache), so a ban applies on the next request.
 */
@Injectable()
export class SessionGuard extends AuthGuard {
  // The parent's reflector is private; Reflector only reads decorator metadata.
  private readonly metadata = new Reflector();

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = await super.canActivate(context);
    const request = context.switchToHttp().getRequest<SessionRequest>();
    if (!request.user?.banned) return allowed;
    request.user = null;
    request.session = null;
    const targets = [context.getHandler(), context.getClass()];
    // Same metadata keys the library's @AllowAnonymous() and @OptionalAuth() set.
    if (this.metadata.getAllAndOverride<boolean>("PUBLIC", targets)) return true;
    if (this.metadata.getAllAndOverride<boolean>("OPTIONAL", targets)) return true;
    throw new UnauthorizedException();
  }
}
