"use client";

import { LogOut } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { type ActionTarget, revokeSessionsAction } from "../account-actions";
import { ConfirmActionDialog } from "../confirm-action-dialog";

/** Revoke every session of a user, behind the confirm dialog. Off for yourself. */
export function RevokeSessionsButton({
  target,
  isSelf,
}: {
  target: ActionTarget;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <Button
        type="button"
        variant="secondary"
        disabled={isSelf}
        aria-describedby={isSelf ? noteId : undefined}
        onClick={() => setOpen(true)}
        className="min-h-11 md:min-h-0"
      >
        <LogOut aria-hidden className="size-4 text-red-700 dark:text-red-300" />
        Revoke sessions
      </Button>
      {isSelf && (
        <p id={noteId} className="max-w-64 text-xs text-sub sm:text-right">
          You can&apos;t revoke your own sessions here. Sign out instead.
        </p>
      )}
      <ConfirmActionDialog
        action={revokeSessionsAction(target)}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
