"use client";

import { reasonSchema } from "@billsafi/contracts";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { controlBase } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { ApiError, type FieldIssue } from "@/lib/api-error";
import { apiRequest } from "@/lib/api.client";
import { useAdminToast } from "../admin-toast";

const REASON_MAX = 500;

export interface FormActionDialogProps<R> {
  title: string;
  /** Who the action is about. */
  target: { name: string; detail: string };
  /** API path under /api/v1. */
  path: string;
  /** Send an Idempotency-Key, made once per opening, so a retry replays instead of repeating. */
  idempotent?: boolean;
  submitLabel: string;
  destructive?: boolean;
  /**
   * Checks the fields and returns the request body (without the reason), or null after
   * showing field errors.
   */
  buildBody: () => Record<string, unknown> | null;
  /** Field errors the API sent back, for the form to show by its fields. */
  onServerIssues: (issues: FieldIssue[]) => void;
  /** What will happen, worked out from the fields as they are now. */
  preview: React.ReactNode;
  successMessage: (response: R) => string;
  onClose: () => void;
  children: React.ReactNode;
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return error.message || "Too many admin actions. Wait a minute.";
    if (error.status === 400 && error.issues.length > 0) {
      return "Some fields need another look. Nothing was changed.";
    }
    if ([400, 404, 409].includes(error.status)) return error.message;
  }
  return "That didn't go through. Nothing was changed. Try again.";
}

/**
 * A form behind a dialog for an admin action: the fields, a preview of the result, a
 * required reason, then the API call, a toast and a refresh. Mount it only while open, so
 * every opening starts clean with a new Idempotency-Key.
 */
export function FormActionDialog<R>(props: FormActionDialogProps<R>) {
  const router = useRouter();
  const toast = useAdminToast();
  const reasonId = useId();
  const [key] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const closedWhileBusy = useRef(false);
  const busy = submitting || refreshing;
  const length = reason.trim().length;

  function close() {
    if (busy) closedWhileBusy.current = true;
    props.onClose();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const reasonCheck = reasonSchema.safeParse(reason);
    setReasonError(reasonCheck.success ? "" : reasonCheck.error.issues[0]!.message);
    const body = props.buildBody();
    if (!body || !reasonCheck.success) return;
    setSubmitting(true);
    setError("");
    closedWhileBusy.current = false;
    let response: R;
    try {
      response = await apiRequest<R>(props.path, {
        method: "POST",
        body: JSON.stringify({ ...body, reason: reasonCheck.data }),
        headers: props.idempotent ? { "Idempotency-Key": key } : undefined,
      });
    } catch (caught) {
      setSubmitting(false);
      if (caught instanceof ApiError && caught.status === 400) {
        props.onServerIssues(caught.issues);
        const reasonIssue = caught.issues.find((issue) => issue.path === "reason");
        if (reasonIssue) setReasonError(reasonIssue.message);
      }
      if (closedWhileBusy.current) toast({ tone: "error", message: errorText(caught) });
      else setError(errorText(caught));
      return;
    }
    setSubmitting(false);
    startTransition(() => router.refresh());
    toast({ tone: "success", message: props.successMessage(response) });
    props.onClose();
  }

  return (
    <Dialog open onClose={close} title={props.title} dismissible={!busy}>
      <form onSubmit={onSubmit} noValidate className="pt-4 text-left">
        <div className="rounded-panel border border-line bg-background px-3 py-2.5">
          <p className="text-sm font-medium break-words">{props.target.name}</p>
          <p className="text-xs break-all text-sub">{props.target.detail}</p>
        </div>
        {props.children}
        <div
          aria-live="polite"
          className="mt-4 rounded-panel border border-line bg-soft px-3 py-2.5 text-sm"
        >
          {props.preview}
        </div>
        <label htmlFor={reasonId} className="mt-4 block text-xs text-sub">
          Reason (kept in the audit log)
        </label>
        <textarea
          id={reasonId}
          rows={2}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={`${reasonId}-help`}
          className={`mt-1.5 ${controlBase}`}
        />
        <p
          id={`${reasonId}-help`}
          className={`mt-1.5 text-xs ${reasonError ? "text-red-700 dark:text-red-300" : "text-sub"}`}
        >
          {reasonError || `${length} of ${REASON_MAX} characters, at least 5.`}
        </p>
        <FormMessage>{error}</FormMessage>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant={props.destructive ? "danger" : "primary"} pending={busy}>
            {props.submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
