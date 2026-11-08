import type { RecurringInvoice, RecurringInvoiceSummary } from "@billsafi/contracts";
import type { schema } from "@billsafi/db";
import { calculateInvoice, type RecurringSchedule, upcomingRunDates } from "@billsafi/domain";

type ScheduleRow = typeof schema.recurringInvoices.$inferSelect;
type ItemRow = typeof schema.recurringInvoiceItems.$inferSelect;
type InvoiceRow = Pick<
  typeof schema.invoices.$inferSelect,
  "id" | "status" | "invoiceNumber" | "periodDate" | "total"
>;

export function discountOf(row: ScheduleRow) {
  return row.discountType && row.discountValue
    ? { type: row.discountType as "fixed" | "percentage", value: row.discountValue }
    : null;
}

export function scheduleState(row: ScheduleRow): RecurringSchedule {
  return {
    startDate: row.startDate,
    frequency: row.frequency,
    nextIndex: row.nextIndex,
    endDate: row.endDate,
    maxCount: row.maxCount,
    generatedCount: row.generatedCount,
  };
}

function totals(row: ScheduleRow, items: ItemRow[]) {
  return calculateInvoice({ items, discount: discountOf(row), taxRate: row.taxRate });
}

export function toRecurringSummary(
  row: ScheduleRow,
  clientName: string,
  items: ItemRow[],
): RecurringInvoiceSummary {
  return {
    id: row.id,
    clientId: row.clientId,
    clientName,
    status: row.status,
    pausedReason: row.pausedReason,
    frequency: row.frequency,
    mode: row.mode,
    currency: row.currency,
    total: totals(row, items).total,
    nextRunDate: row.nextRunDate,
    generatedCount: row.generatedCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toRecurringInvoice(
  row: ScheduleRow,
  clientName: string,
  items: ItemRow[],
  invoices: InvoiceRow[],
): RecurringInvoice {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const calc = totals(row, sorted);
  return {
    ...toRecurringSummary(row, clientName, sorted),
    startDate: row.startDate,
    endDate: row.endDate,
    maxCount: row.maxCount,
    paymentTermsDays: row.paymentTermsDays,
    items: sorted.map((item, index) => ({
      id: item.id,
      position: item.position,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: calc.lineTotals[index]!,
      savedItemId: item.savedItemId,
    })),
    discount: discountOf(row),
    taxRate: row.taxRate,
    subtotal: calc.subtotal,
    discountAmount: calc.discountAmount,
    taxAmount: calc.taxAmount,
    notes: row.notes,
    paymentInstructions: row.paymentInstructions,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    upcoming: row.status === "ended" ? [] : upcomingRunDates(scheduleState(row), 3),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      status: invoice.status,
      invoiceNumber: invoice.invoiceNumber,
      periodDate: invoice.periodDate!,
      total: invoice.total,
    })),
    createdAt: row.createdAt.toISOString(),
  };
}
