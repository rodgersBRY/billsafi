import { Info } from "lucide-react";

/** The message shown in place of a sign-up form while registration is closed. */
export function RegistrationClosedNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mt-5 flex items-start gap-2.5 rounded-panel border border-info-line bg-info-bg p-3.5 text-sm text-info-ink"
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="break-words">{message}</span>
    </div>
  );
}
