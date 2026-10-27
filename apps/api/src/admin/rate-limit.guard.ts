import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../common/current-user.js";

/** Sliding-window counter per key, kept in memory: one API process, one admin. */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit; returns 0 if allowed, otherwise milliseconds until the next slot frees. */
  hit(key: string): number {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return recent[0]! + this.windowMs - now;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return 0;
  }
}

export const ADMIN_ACTION_LIMITER = Symbol("ADMIN_ACTION_LIMITER");

/**
 * Caps admin actions at 10 a minute per admin, so a stolen session or a stuck button
 * cannot suspend accounts in bulk. Runs after AdminGuard, so the user is known.
 */
@Injectable()
export class AdminActionRateLimitGuard implements CanActivate {
  constructor(@Inject(ADMIN_ACTION_LIMITER) private readonly limiter: SlidingWindowLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const userId = http.getRequest<Partial<AuthenticatedRequest>>().user?.id;
    // AdminGuard has already refused anyone without a user; this is only a backstop.
    if (!userId) return false;
    const waitMs = this.limiter.hit(userId);
    if (waitMs === 0) return true;
    http.getResponse<Response>().setHeader("Retry-After", String(Math.ceil(waitMs / 1000)));
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: "Too Many Requests",
        message: "Too many admin actions. Wait a minute and try again.",
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
