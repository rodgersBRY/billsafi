import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AdminHealth, AdminHealthIndicator, AdminHealthLink } from "@billsafi/contracts";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { HEALTH_INDICATOR_PROVIDERS, type HealthIndicatorProvider } from "./health-provider.js";

/** A check that takes longer than this is shown as failing, so one hang can't stall the page. */
export const HEALTH_CHECK_TIMEOUT_MS = 5000;

const FAILED_DETAIL = "This check could not run. The error is in the API log.";
const TIMEOUT_DETAIL = "This check did not finish in time.";

class CheckTimeout extends Error {}

/** Runs every registered provider at once and turns each outcome into an indicator. */
@Injectable()
export class AdminHealthService {
  private readonly logger = new Logger(AdminHealthService.name);

  constructor(
    @Inject(HEALTH_INDICATOR_PROVIDERS) private readonly providers: HealthIndicatorProvider[],
    @Inject(ENV) private readonly env: Pick<Env, "ADMIN_SENTRY_URL" | "ADMIN_UPTIME_URL">,
  ) {}

  async health(now = new Date()): Promise<AdminHealth> {
    const indicators = await Promise.all(this.providers.map((provider) => this.run(provider, now)));
    return { indicators, links: this.links(), generatedAt: now.toISOString() };
  }

  private async run(provider: HealthIndicatorProvider, now: Date): Promise<AdminHealthIndicator> {
    const base = {
      key: provider.key,
      label: provider.label,
      source: provider.source,
      staleAfterSeconds: provider.staleAfterSeconds,
    };
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new CheckTimeout()), HEALTH_CHECK_TIMEOUT_MS);
      });
      const reading = await Promise.race([provider.check(now), timeout]);
      const { checkedAt, ...rest } = reading;
      return { ...base, ...rest, checkedAt: (checkedAt ?? now).toISOString() };
    } catch (error) {
      if (!(error instanceof CheckTimeout)) {
        this.logger.error(`Health check "${provider.key}" failed`, error);
      }
      return {
        ...base,
        status: "failing",
        value: null,
        detail: error instanceof CheckTimeout ? TIMEOUT_DETAIL : FAILED_DETAIL,
        checkedAt: now.toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private links(): AdminHealthLink[] {
    const links: AdminHealthLink[] = [];
    if (this.env.ADMIN_SENTRY_URL) {
      links.push({
        key: "sentry",
        label: "Sentry",
        href: this.env.ADMIN_SENTRY_URL,
        description: "Errors and slow requests, with the full detail.",
      });
    }
    if (this.env.ADMIN_UPTIME_URL) {
      links.push({
        key: "uptime",
        label: "Uptime monitor",
        href: this.env.ADMIN_UPTIME_URL,
        description: "Availability and response times from outside.",
      });
    }
    return links;
  }
}
