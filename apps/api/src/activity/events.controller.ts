import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { publicEventSchema } from "@billsafi/contracts";
import { nairobiDate } from "@billsafi/domain";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { Request, Response } from "express";
import { rateLimitKey } from "../common/client-ip.js";
import { SlidingWindowLimiter } from "../admin/shared/rate-limit.guard.js";
import { ActivityRecorder } from "./activity-recorder.js";

export const EVENT_INTAKE_LIMITER = Symbol("EVENT_INTAKE_LIMITER");
export const EVENT_INTAKE_GLOBAL_LIMITER = Symbol("EVENT_INTAKE_GLOBAL_LIMITER");
/** Across all addresses; over this, events are dropped and still answered with 204. */
export const EVENT_INTAKE_GLOBAL_PER_MINUTE = 600;
/** Per IP address (IPv6 per /64). A real visitor sends a handful of events in a session. */
export const EVENT_INTAKE_LIMIT_PER_MINUTE = 60;

/**
 * The one public intake (D066): anonymous free generator events only. It answers 204 to
 * everything it accepts or drops, so it never says which names or shapes are valid. The
 * only other answer is 429 once an address is over its limit.
 */
@AllowAnonymous()
@Controller("events")
export class EventsController {
  constructor(
    private readonly recorder: ActivityRecorder,
    @Inject(EVENT_INTAKE_LIMITER) private readonly limiter: SlidingWindowLimiter,
    @Inject(EVENT_INTAKE_GLOBAL_LIMITER) private readonly globalLimiter: SlidingWindowLimiter,
  ) {}

  @Post()
  @HttpCode(204)
  intake(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const waitMs = this.limiter.hit(rateLimitKey(req.ip));
    if (waitMs > 0) {
      res.setHeader("Retry-After", String(Math.ceil(waitMs / 1000)));
      throw new HttpException("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }
    if (this.globalLimiter.hit("all") > 0) return;
    const event = publicEventSchema.safeParse(body);
    if (!event.success) return;
    // One of each step per visitor per Nairobi day, so replays don't inflate the funnel.
    this.recorder.productEvent(
      event.data.name,
      {},
      {
        anonymousId: event.data.anonymousId,
        dedupeKey: `${event.data.name}:${event.data.anonymousId}:${nairobiDate(new Date())}`,
      },
    );
  }
}
