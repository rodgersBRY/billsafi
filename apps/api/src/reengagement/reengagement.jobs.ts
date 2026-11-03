import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { ActivityRecorder } from "../activity/activity-recorder.js";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { ReengagementService } from "./reengagement.service.js";

/** Hourly, so emails spread across Nairobi working hours instead of one burst. */
const INTERVAL_MS = 60 * 60 * 1000;
const FIRST_RUN_MS = 5 * 60 * 1000;

@Injectable()
export class ReengagementJobs implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ReengagementJobs.name);
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;

  constructor(
    private readonly reengagement: ReengagementService,
    private readonly recorder: ActivityRecorder,
    @Inject(ENV) private readonly env: Pick<Env, "REENGAGEMENT_JOBS">,
  ) {}

  onApplicationBootstrap() {
    if (!this.env.REENGAGEMENT_JOBS) return;
    this.timer = setInterval(() => void this.run(), INTERVAL_MS);
    this.timer.unref();
    this.first = setTimeout(() => void this.run(), FIRST_RUN_MS);
    this.first.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    if (this.first) clearTimeout(this.first);
  }

  async run(now = new Date()) {
    try {
      await this.recorder.trackJob("reengagement_emails", async () => {
        const { sent, skipped } = await this.reengagement.sendDue(now);
        if (sent > 0) this.logger.log(`Sent ${sent} check-in email(s)`);
        return skipped ?? `sent ${sent} email${sent === 1 ? "" : "s"}`;
      });
    } catch (error) {
      this.logger.error(`Check-in email job failed: ${String(error)}`);
    }
  }
}
