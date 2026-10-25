"use client";

import { useRef } from "react";
import { useConfirmAction } from "./action-host";
import type { ConfirmAction } from "./confirm-action-dialog";

interface ConfirmButtonProps {
  action: ConfirmAction;
  /** Why the action is off for this row; the button is disabled and says so. */
  blocked?: string | null;
  className?: string;
  children: React.ReactNode;
}

/** A row button that opens the surrounding ActionHost's confirm dialog. */
export function ConfirmButton({ action, blocked, className = "", children }: ConfirmButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const confirm = useConfirmAction();
  return (
    <button
      ref={ref}
      type="button"
      disabled={Boolean(blocked)}
      title={blocked ?? undefined}
      onClick={() => confirm(action, ref.current)}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-panel border border-line bg-panel px-3 text-sm hover:bg-soft focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 md:min-h-9 ${className}`}
    >
      {children}
    </button>
  );
}
