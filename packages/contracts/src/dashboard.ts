import type { InvoiceSummary } from "./invoices.js";

/** Business dashboard totals from effective payments (D012, D049). */
export interface Dashboard {
  currency: string;
  outstanding: string;
  overdue: string;
  receivedThisMonth: string;
  recentInvoices: InvoiceSummary[];
  /** Sent quotes not past their valid-until day. Never part of income totals. */
  openQuotes: { count: number; total: string };
}
