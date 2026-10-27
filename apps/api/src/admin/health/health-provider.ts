import type { AdminHealthIndicator, AdminHealthStatus } from "@billsafi/contracts";

/** What a provider found. The service adds the key, label, source and check time. */
export interface HealthReading {
  status: AdminHealthStatus;
  value: string | null;
  detail: string;
  data?: AdminHealthIndicator["data"];
  /** When the fact was recorded; leave out for a live check and the service uses "now". */
  checkedAt?: Date;
  href?: string;
}

/**
 * One health indicator. Adding an indicator means writing one of these and listing it in
 * HEALTH_INDICATOR_PROVIDERS (health.module.ts); the service, route and page do not change.
 * A provider that throws is shown as failing with a generic message, never as a 500.
 */
export interface HealthIndicatorProvider {
  /** Stable id, shown in the response and used by the web app. */
  readonly key: string;
  readonly label: string;
  /** Where the fact comes from, such as "Live query". */
  readonly source: string;
  /** Seconds after which a recorded reading is too old to trust; null for a live check. */
  readonly staleAfterSeconds: number | null;
  check(now: Date): Promise<HealthReading>;
}

export const HEALTH_INDICATOR_PROVIDERS = Symbol("HEALTH_INDICATOR_PROVIDERS");
