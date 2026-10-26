import type { HealthIndicatorProvider, HealthReading } from "./health-provider.js";

/**
 * An indicator whose facts are not recorded yet. It says so instead of showing a green
 * dot. When recording exists, replace this entry with a provider that reads it.
 */
export class UnrecordedHealthProvider implements HealthIndicatorProvider {
  readonly staleAfterSeconds = null;

  constructor(
    readonly key: string,
    readonly label: string,
    readonly source: string,
    private readonly detail: string,
  ) {}

  async check(): Promise<HealthReading> {
    return { status: "unknown", value: null, detail: this.detail };
  }
}
