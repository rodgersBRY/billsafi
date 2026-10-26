import { Controller, Get, Inject } from "@nestjs/common";
import type { PlatformInfo } from "@billsafi/contracts";
import { type DatabaseConnection } from "@billsafi/db";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { DATABASE } from "../database/database.module.js";
import { PLATFORM_CACHE } from "./platform-cache.js";
import { readSetting } from "./platform-settings.js";
import type { TtlCache } from "../admin/shared/ttl-cache.js";

/** The public page cache; the admin settings PUT clears it. */
const CACHE_KEY = "platform";

/**
 * What a visitor needs before signing in: whether sign-ups are open, the banner, and the
 * support contact. Nothing else leaves here (no who-changed-it, no reasons, no timestamps).
 * Cached for 30 seconds.
 */
@AllowAnonymous()
@Controller("platform")
export class PlatformController {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    @Inject(PLATFORM_CACHE) private readonly cache: TtlCache,
  ) {}

  @Get()
  info(): Promise<PlatformInfo> {
    return this.cache.get(CACHE_KEY, () => this.load(new Date()));
  }

  private async load(now: Date): Promise<PlatformInfo> {
    const db = this.connection.db;
    const [registration, announcement, supportContact] = await Promise.all([
      readSetting(db, "registration"),
      readSetting(db, "announcement"),
      readSetting(db, "support_contact"),
    ]);
    const started = !announcement.startsAt || Date.parse(announcement.startsAt) <= now.getTime();
    const ended = announcement.endsAt && Date.parse(announcement.endsAt) <= now.getTime();
    const showing = announcement.active && started && !ended;
    return {
      registration: { open: registration.open, closedMessage: registration.closedMessage },
      announcement: showing
        ? {
            tone: announcement.tone,
            message: announcement.message,
            linkUrl: announcement.linkUrl ?? null,
          }
        : null,
      supportContact: {
        email: supportContact.email,
        ...(supportContact.whatsapp ? { whatsapp: supportContact.whatsapp } : {}),
        ...(supportContact.hours ? { hours: supportContact.hours } : {}),
      },
    };
  }
}
