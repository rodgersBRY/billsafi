import { type DatabaseConnection, sql } from "@billsafi/db";
import { at, DAY_MS, selectRows } from "../shared/admin-sql.js";
import type { HealthIndicatorProvider, HealthReading } from "./health-provider.js";

/** 1 to 4 failures in 24 hours warn; this many or more fail. */
export const PDF_EMAIL_FAILING_FROM = 5;

/** PDF and email failures in the last 24 hours (D066). Job failures show under Billing jobs. */
export class PdfEmailHealthProvider implements HealthIndicatorProvider {
  readonly key = "pdf_email";
  readonly label = "PDF and email failures";
  readonly source = "Recorded failures";
  readonly staleAfterSeconds = null;

  constructor(private readonly connection: DatabaseConnection) {}

  async check(now: Date): Promise<HealthReading> {
    const [row] = await selectRows<{ pdf: number; email: number; latest: Date | null }>(
      this.connection.db,
      sql`
        select (count(*) filter (where kind = 'pdf'))::int as pdf,
          (count(*) filter (where kind = 'email'))::int as email,
          max(created_at) as latest
        from operation_failures
        where kind in ('pdf', 'email')
          and created_at >= ${at(new Date(now.getTime() - DAY_MS))} and created_at <= ${at(now)}
      `,
    );
    const { pdf, email } = row!;
    const total = pdf + email;
    const data = { pdf, email };
    if (total === 0) {
      return {
        status: "ok",
        value: "0 in 24h",
        detail: "No PDF or email failed in the last 24 hours.",
        data,
      };
    }
    const parts = [`${pdf} PDF`, `${email} email`].filter((_, i) => (i === 0 ? pdf : email) > 0);
    return {
      status: total >= PDF_EMAIL_FAILING_FROM ? "failing" : "warning",
      value: `${total} in 24h`,
      detail: `${parts.join(" and ")} ${total === 1 ? "failure" : "failures"} in the last 24 hours. The recent failures list has the detail.`,
      data,
      checkedAt: row!.latest ? new Date(row!.latest) : undefined,
    };
  }
}
