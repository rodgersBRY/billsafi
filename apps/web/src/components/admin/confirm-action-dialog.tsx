"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form-message";
import { controlBase } from "@/components/ui/field";
import { ApiError } from "@/lib/api-error";
import { apiPost } from "@/lib/api.client";
import { useAdminToast } from "./admin-toast";

const MIN = 5;
const MAX = 500;

export interface ConfirmAction {
  title: string;
  /** Who the action is about, such as the owner's name and email. */
  target: { name: string; detail: string };
  /** What happens, in plain English. */
  impact: string[];
  confirmLabel: string;
  /** API path under /api/v1 that takes { reason }. */
  path: string;
  /** Announced once the action has gone through. */
  successMessage: string;
  destructive?: boolean;
}

interface ConfirmActionDialogProps {
  action: ConfirmAction;
  open: boolean;
  onClose: () => void;
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return error.message || "Too many admin actions. Wait a minute.";
    if (error.status === 400) return error.issues[0]?.message ?? error.message;
    if (error.status === 409 || error.status === 404) return error.message;
  }
  return "That didn't go through. Nothing was changed. Try again.";
}

/** Confirms a sensitive admin action with a required reason, then refreshes the page. */
export function ConfirmActionDialog({ action, open, onClose }: ConfirmActionDialogProps) {
  const router = useRouter();
  const toast = useAdminToast();
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const length = reason.trim().length;
  const valid = length >= MIN && length <= MAX;
  const busy = submitting || refreshing;
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  // Escape is blocked while busy, but a browser can still force the dialog shut (Chrome
  // closes on a second Escape). Then the outcome is reported in a toast instead.
  const closedWhileBusy = useRef(false);

  // Start in the reason box rather than on the dialog's close button.
  useEffect(() => {
    if (open) requestAnimationFrame(() => reasonRef.current?.focus());
  }, [open]);

  function close() {
    if (busy) closedWhileBusy.current = true;
    else {
      setReason("");
      setError("");
    }
    onClose();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || busy) return;
    setSubmitting(true);
    setError("");
    closedWhileBusy.current = false;
    try {
      await apiPost(action.path, { reason: reason.trim() });
    } catch (caught) {
      setSubmitting(false);
      if (closedWhileBusy.current) toast({ tone: "error", message: errorText(caught) });
      else setError(errorText(caught));
      return;
    }
    setSubmitting(false);
    startTransition(() => router.refresh());
    toast({ tone: "success", message: action.successMessage });
    setReason("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={close} title={action.title} dismissible={!busy}>
      <form onSubmit={onSubmit} className="pt-4 text-left">
        <div className="rounded-panel border border-line bg-background px-3 py-2.5">
          <p className="text-sm font-medium break-words">{action.target.name}</p>
          <p className="text-xs break-all text-sub">{action.target.detail}</p>
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
          {action.impact.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <label htmlFor={reasonId} className="mt-4 block text-xs text-sub">
          Reason (kept in the audit log)
        </label>
        <textarea
          ref={reasonRef}
          id={reasonId}
          rows={3}
          required
          maxLength={MAX}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-describedby={`${reasonId}-count`}
          className={`mt-1.5 ${controlBase}`}
        />
        <p id={`${reasonId}-count`} className="mt-1.5 text-xs text-sub">
          {length < MIN
            ? `At least ${MIN} characters. ${length} so far.`
            : `${length} of ${MAX} characters.`}
        </p>
        <FormMessage>{error}</FormMessage>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={action.destructive ? "danger" : "primary"}
            pending={busy}
            disabled={!valid}
          >
            {action.confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
