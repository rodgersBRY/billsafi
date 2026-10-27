import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { ActivityRecorder } from "./activity-recorder.js";
import { PruneService } from "./prune.service.js";

const INTERVAL_MS = 24 * 60 * 60 * 1000;
const FIRST_RUN_MS = 2 * 60 * 1000;

/** Daily clean-up of recorded facts past their retention. Records itself as a job run. */
@Injectable()
export class MaintenanceJobs implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MaintenanceJobs.name);
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;

  constructor(
    private readonly prune: PruneService,
    private readonly recorder: ActivityRecorder,
    @Inject(ENV) private readonly env: Pick<Env, "MAINTENANCE_JOBS">,
  ) {}

  onApplicationBootstrap() {
    if (!this.env.MAINTENANCE_JOBS) return;
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
      await this.recorder.trackJob("maintenance", async () => {
        const counts = await this.prune.prune(now);
        const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
        return `removed ${total} old record${total === 1 ? "" : "s"}`;
      });
    } catch (error) {
      this.logger.error(`Maintenance job failed: ${String(error)}`);
    }
  }
}
