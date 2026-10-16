import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { UserSession } from "@thallesp/nestjs-better-auth";

export type AuthenticatedRequest = {
  user: UserSession["user"];
  params: Record<string, string>;
};

/** The signed-in user's id. Routes are protected by the global auth guard. */
export const CurrentUserId = createParamDecorator((_: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().user.id;
});
