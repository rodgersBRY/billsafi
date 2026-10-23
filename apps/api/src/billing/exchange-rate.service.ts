import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";

export const RATE_URL = "https://open.er-api.com/v6/latest/USD";

const REFRESH_MS = 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
/** Refuse to charge with a rate older than this. */
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const TIMEOUT_MS = 5000;

const rateResponse = z.object({
  result: z.literal("success"),
  time_last_update_unix: z.number(),
  rates: z.object({ KES: z.number().positive() }),
});

export interface UsdKesRate {
  rate: string;
  updatedAt: Date | null;
}

/** The USD to KES rate for turning USD plan prices into M-Pesa charges. */
@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private cached: UsdKesRate | null = null;
  private nextFetchAt = 0;
  private inflight: Promise<void> | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  /** The current rate, or null when none is available or the last one is too old. */
  async usdKes(now = Date.now()): Promise<UsdKesRate | null> {
    if (this.env.USD_KES_RATE) return { rate: String(this.env.USD_KES_RATE), updatedAt: null };
    if (now >= this.nextFetchAt) {
      this.inflight ??= this.fetchRate().finally(() => {
        this.inflight = null;
      });
      await this.inflight;
    }
    if (!this.cached?.updatedAt || now - this.cached.updatedAt.getTime() > MAX_AGE_MS) return null;
    return this.cached;
  }

  private async fetchRate(): Promise<void> {
    try {
      const response = await fetch(RATE_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = rateResponse.parse(await response.json());
      this.cached = {
        rate: String(body.rates.KES),
        updatedAt: new Date(body.time_last_update_unix * 1000),
      };
      this.nextFetchAt = Date.now() + REFRESH_MS;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not fetch the USD to KES rate: ${message}`);
      this.nextFetchAt = Date.now() + RETRY_MS;
    }
  }
}
