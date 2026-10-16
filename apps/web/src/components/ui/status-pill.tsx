import { type InvoiceStatus, invoiceStatusLabels } from "@tallynest/contracts";

const tones: Record<InvoiceStatus, string> = {
  draft: "bg-background text-sub",
  ready: "bg-soft text-teal",
  partially_paid: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  paid: "bg-soft text-teal",
  cancelled: "bg-background text-sub line-through",
};

export function StatusPill({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`inline-block rounded-md px-1.75 py-1 text-xs ${tones[status]}`}>
      {invoiceStatusLabels[status]}
    </span>
  );
}
