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
import { RecurringRunner } from "./recurring-runner.service.js";

/** Runs are daily, so hourly checks are enough and pick up a missed hour soon after. */
const INTERVAL_MS = 60 * 60 * 1000;
const FIRST_RUN_MS = 60 * 1000;

@Injectable()
export class RecurringJobs implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RecurringJobs.name);
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;

  constructor(
    private readonly runner: RecurringRunner,
    private readonly recorder: ActivityRecorder,
    @Inject(ENV) private readonly env: Pick<Env, "RECURRING_JOBS">,
  ) {}

  onApplicationBootstrap() {
    if (!this.env.RECURRING_JOBS) return;
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
      await this.recorder.trackJob("recurring_invoices", async () => {
        const { created, paused, ended } = await this.runner.runDue(now);
        if (created > 0) this.logger.log(`Made ${created} recurring invoice(s)`);
        return `made ${created}, paused ${paused}, ended ${ended}`;
      });
    } catch (error) {
      this.logger.error(`Recurring invoices job failed: ${String(error)}`);
    }
  }
}
