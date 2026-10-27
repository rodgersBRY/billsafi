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
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { Request, Response } from "express";
import { SlidingWindowLimiter } from "../admin/shared/rate-limit.guard.js";
import { ActivityRecorder } from "./activity-recorder.js";

export const EVENT_INTAKE_LIMITER = Symbol("EVENT_INTAKE_LIMITER");
/** Per IP address. A real visitor sends a handful of events in a session. */
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
  ) {}

  @Post()
  @HttpCode(204)
  intake(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const waitMs = this.limiter.hit(req.ip ?? "unknown");
    if (waitMs > 0) {
      res.setHeader("Retry-After", String(Math.ceil(waitMs / 1000)));
      throw new HttpException("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }
    const event = publicEventSchema.safeParse(body);
    if (!event.success) return;
    this.recorder.productEvent(event.data.name, {}, { anonymousId: event.data.anonymousId });
  }
}
