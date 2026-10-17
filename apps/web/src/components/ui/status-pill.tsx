import { type InvoiceStatus, invoiceStatusLabels } from "@tallynest/contracts";

// Approved invoice management colours: amber for partly paid, teal for paid, neutral otherwise.
const tones: Record<InvoiceStatus, string> = {
  draft: "bg-background text-sub",
  ready: "bg-background text-sub",
  partially_paid: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  paid: "bg-soft text-accent",
  cancelled: "bg-background text-sub",
};

export function StatusPill({
  status,
  overdue = false,
}: {
  status: InvoiceStatus;
  overdue?: boolean;
}) {
  return (
    <span className="inline-flex flex-col items-start">
      <span className={`inline-block rounded-md px-1.75 py-1 text-xs ${tones[status]}`}>
        {invoiceStatusLabels[status]}
      </span>
      {overdue && <span className="mt-0.75 text-xs text-red-700 dark:text-red-300">Overdue</span>}
    </span>
  );
}
