"use client";

import type { AdminAccountStatus } from "@billsafi/contracts";
import { Ban, CircleCheck } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { type ActionTarget, reactivateAction, suspendAction } from "../account-actions";
import { ConfirmActionDialog } from "../confirm-action-dialog";

interface AccountActionButtonProps {
  target: ActionTarget;
  accountStatus: AdminAccountStatus;
  /** Why suspending is off for this account, shown under the button. */
  blocked: string | null;
}

/** Suspend or Reactivate on the tenant page, behind the confirm dialog. */
export function AccountActionButton({ target, accountStatus, blocked }: AccountActionButtonProps) {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const suspended = accountStatus === "suspended";
  const disabled = !suspended && Boolean(blocked);

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <Button
        type="button"
        variant={suspended ? "primary" : "secondary"}
        disabled={disabled}
        aria-describedby={disabled ? noteId : undefined}
        onClick={() => setOpen(true)}
        className="min-h-11 md:min-h-0"
      >
        {suspended ? (
          <CircleCheck aria-hidden className="size-4" />
        ) : (
          <Ban aria-hidden className="size-4 text-red-700 dark:text-red-300" />
        )}
        {suspended ? "Reactivate account" : "Suspend account"}
      </Button>
      {disabled && (
        <p id={noteId} className="max-w-64 text-xs text-sub sm:text-right">
          {blocked}
        </p>
      )}
      <ConfirmActionDialog
        action={suspended ? reactivateAction(target) : suspendAction(target)}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
