import { type DatabaseConnection, schema, sql } from "@billsafi/db";
import { stuckPaymentCutoff } from "@billsafi/domain";
import { at, DAY_MS, ratio, selectRows } from "../shared/admin-sql.js";
import type { HealthIndicatorProvider, HealthReading } from "./health-provider.js";

/** Below this share of settled checkouts in 24 hours, with enough of them, M-Pesa warns. */
export const MPESA_WARNING_RATE = 0.8;
export const MPESA_MIN_SETTLED = 5;

const percent = (rate: number | null) =>
  rate === null ? "no checkouts" : `${Math.round(rate * 100)}%`;

/**
 * M-Pesa plan checkouts. The success rate counts succeeded over succeeded plus failed by
 * the time the checkout started, pending ones left out, as on the Overview (D063). Stuck is
 * the same predicate as the attention list: pending for longer than the stuck cutoff.
 */
export class MpesaHealthProvider implements HealthIndicatorProvider {
  readonly key = "mpesa";
  readonly label = "M-Pesa checkouts";
  readonly source = "Live query";
  readonly staleAfterSeconds = null;

  constructor(private readonly connection: DatabaseConnection) {}

  async check(now: Date): Promise<HealthReading> {
    const since = (days: number) => at(new Date(now.getTime() - days * DAY_MS));
    const mpesa = sql`provider <> ${schema.MANUAL_PROVIDER}`;
    const [facts] = await selectRows<{
      ok24: number;
      failed24: number;
      ok7: number;
      failed7: number;
      stuck: number;
    }>(
      this.connection.db,
      sql`
        select
          (count(*) filter (where status = 'succeeded' and created_at >= ${since(1)}))::int as ok24,
          (count(*) filter (where status = 'failed' and created_at >= ${since(1)}))::int as failed24,
          (count(*) filter (where status = 'succeeded' and created_at >= ${since(7)}))::int as ok7,
          (count(*) filter (where status = 'failed' and created_at >= ${since(7)}))::int as failed7,
          (count(*) filter (where status = 'pending'
            and created_at < ${at(stuckPaymentCutoff(now))}))::int as stuck
        from subscription_payments
        where ${mpesa}
      `,
    );
    const f = facts!;
    const settled24 = f.ok24 + f.failed24;
    const settled7 = f.ok7 + f.failed7;
    const rate24 = ratio(f.ok24, settled24);
    const rate7 = ratio(f.ok7, settled7);
    const data = {
      successRate24h: rate24,
      successRate7d: rate7,
      settled24h: settled24,
      settled7d: settled7,
      stuck: f.stuck,
    };

    const lowRate =
      settled24 >= MPESA_MIN_SETTLED && rate24 !== null && rate24 < MPESA_WARNING_RATE;
    const problems: string[] = [];
    if (f.stuck > 0) {
      problems.push(`${f.stuck} ${f.stuck === 1 ? "checkout is" : "checkouts are"} stuck pending`);
    }
    if (lowRate) {
      problems.push(`only ${percent(rate24)} of the last ${settled24} settled checkouts succeeded`);
    }
    if (problems.length > 0) {
      const text = problems.join(", and ");
      return {
        status: "warning",
        value: `${percent(rate24)} in 24h, ${percent(rate7)} in 7d`,
        detail: `${text[0]!.toUpperCase()}${text.slice(1)}.`,
        data,
      };
    }
    if (settled7 === 0) {
      return {
        status: "unknown",
        value: null,
        detail:
          "No M-Pesa checkouts have settled in the last 7 days, so there is no rate to judge.",
        data,
      };
    }
    return {
      status: "ok",
      value: `${percent(rate24)} in 24h, ${percent(rate7)} in 7d`,
      detail: "No stuck checkouts, and the success rate is healthy.",
      data,
    };
  }
}
