import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
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

  async run() {
    try {
      await this.billing.sweepPending();
      const sent = await this.billing.sendReminders();
      if (sent > 0) this.logger.log(`Sent ${sent} renewal reminder(s)`);
    } catch (error) {
      this.logger.error(`Billing job failed: ${String(error)}`);
    }
  }
}
