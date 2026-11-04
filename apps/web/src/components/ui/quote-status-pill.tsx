import { type QuoteStatus, quoteStatusLabels } from "@billsafi/contracts";

const tones: Record<QuoteStatus | "expired", string> = {
  draft: "bg-background text-sub",
  sent: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  expired: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  accepted: "bg-soft text-accent",
  declined: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  withdrawn: "bg-background text-sub line-through",
  converted: "bg-soft text-accent",
};

export function QuoteStatusPill({
  status,
  expired = false,
}: {
  status: QuoteStatus;
  expired?: boolean;
}) {
  const shown = expired ? "expired" : status;
  return (
    <span className={`inline-block rounded-md px-1.75 py-1 text-xs ${tones[shown]}`}>
      {quoteStatusLabels[shown]}
    </span>
  );
}
