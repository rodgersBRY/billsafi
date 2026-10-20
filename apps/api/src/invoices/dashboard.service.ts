import { Inject, Injectable } from "@nestjs/common";
import type { Dashboard } from "@billsafi/contracts";
import { type DatabaseConnection, schema, sql } from "@billsafi/db";
import { nairobiCalendarMonth, nairobiDate } from "@billsafi/domain";
import { DATABASE } from "../database/database.module.js";
import { InvoicesService } from "./invoices.service.js";

const { invoices, invoicePayments } = schema;

const RECENT_INVOICES = 5;

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly invoices: InvoicesService,
  ) {}

  /**
   * Outstanding and overdue balances for Ready and Partially paid invoices, and
   * receipts this Nairobi month by payment date, from effective payments only (D012, D049).
   */
  async get(businessId: string, at = new Date()): Promise<Dashboard> {
    const db = this.connection.db;
    const today = nairobiDate(at);
    const month = nairobiCalendarMonth(at);
    const monthStart = nairobiDate(month.start);
    const nextMonthStart = nairobiDate(month.end);

    const [balances] = await db
      .select({
        outstanding: sql<string>`coalesce(sum(${invoices.total} - coalesce(paid.amount, 0)), 0)::numeric(14,2)::text`,
        overdue: sql<string>`coalesce(sum(${invoices.total} - coalesce(paid.amount, 0)) filter (where ${invoices.dueDate} < ${today}), 0)::numeric(14,2)::text`,
      })
      .from(invoices)
      .leftJoin(
        sql`(select invoice_id, sum(amount) as amount from invoice_payments
             where reversed_at is null group by invoice_id) as paid`,
        sql`paid.invoice_id = ${invoices.id}`,
      )
      .where(
        sql`${invoices.businessId} = ${businessId} and ${invoices.status} in ('ready', 'partially_paid')`,
      );

    const [received] = await db
      .select({
        total: sql<string>`coalesce(sum(${invoicePayments.amount}), 0)::numeric(14,2)::text`,
      })
      .from(invoicePayments)
      .where(
        sql`${invoicePayments.businessId} = ${businessId}
          and ${invoicePayments.reversedAt} is null
          and ${invoicePayments.paymentDate} >= ${monthStart}
          and ${invoicePayments.paymentDate} < ${nextMonthStart}`,
      );

    const recent = await this.invoices.list(businessId, {});
    return {
      currency: "KES",
      outstanding: balances!.outstanding,
      overdue: balances!.overdue,
      receivedThisMonth: received!.total,
      recentInvoices: recent
        .filter((invoice) => invoice.status !== "draft")
        .slice(0, RECENT_INVOICES),
    };
  }
}
