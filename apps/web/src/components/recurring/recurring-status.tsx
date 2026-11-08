import type { RecurringPauseReason, RecurringStatus } from "@billsafi/contracts";

const tones: Record<RecurringStatus, string> = {
  active: "bg-soft text-accent",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  ended: "bg-background text-sub",
};

const pausedLabels: Record<RecurringPauseReason, string> = {
  user: "Paused",
  pro_ended: "Paused: Pro ended",
  client_archived: "Paused: client archived",
};

export function recurringStatusLabel(
  status: RecurringStatus,
  pausedReason: RecurringPauseReason | null,
): string {
  if (status === "paused") return pausedLabels[pausedReason ?? "user"];
  return status === "active" ? "Active" : "Ended";
}

export function RecurringStatusPill({
  status,
  pausedReason,
}: {
  status: RecurringStatus;
  pausedReason: RecurringPauseReason | null;
}) {
  return (
    <span className={`inline-block rounded-md px-1.75 py-1 text-xs ${tones[status]}`}>
      {recurringStatusLabel(status, pausedReason)}
    </span>
  );
}
