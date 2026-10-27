import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { ActivityRecorder } from "../activity/activity-recorder.js";
import type { JobName } from "@billsafi/contracts";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { BillingService } from "./billing.service.js";

const INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class BillingJobs implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BillingJobs.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly billing: BillingService,
    private readonly recorder: ActivityRecorder,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onApplicationBootstrap() {
    if (!this.env.BILLING_JOBS) return;
    this.timer = setInterval(() => void this.run(), INTERVAL_MS);
    this.timer.unref();
    setTimeout(() => void this.run(), 10_000).unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Three steps, each recorded as a job run. A failing step is logged and the next one
   * still runs, so a stuck sweep does not stop reminders.
   */
  async run() {
    await this.step("billing_sweep", async () => {
      await this.billing.sweepPending();
    });
    await this.step("renewal_reminders", async () => {
      const sent = await this.billing.sendReminders();
      if (sent > 0) this.logger.log(`Sent ${sent} renewal reminder(s)`);
      return `sent ${sent} reminder${sent === 1 ? "" : "s"}`;
    });
    await this.step("idempotency_prune", async () => {
      await this.billing.pruneIdempotencyKeys();
    });
  }

  private async step(job: JobName, work: () => Promise<string | void>) {
    try {
      await this.recorder.trackJob(job, work);
    } catch (error) {
      this.logger.error(`Billing job ${job} failed: ${String(error)}`);
    }
  }
}
