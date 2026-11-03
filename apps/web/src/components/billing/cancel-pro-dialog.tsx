"use client";

import {
  type CancelProInput,
  type CancelReason,
  cancelReasonLabels,
  cancelReasons,
} from "@billsafi/contracts";
import { FREE_PLAN, PRO_PLAN } from "@billsafi/domain";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";

interface CancelProDialogProps {
  open: boolean;
  /** When paid access ends, already formatted for display. */
  until: string;
  pending: boolean;
  error?: string;
  noteError?: string;
  onClose: () => void;
  onConfirm: (feedback: CancelProInput) => void;
}

/** Asks before cancelling Pro: what changes, and why they're leaving (optional). */
export function CancelProDialog({
  open,
  until,
  pending,
  error,
  noteError,
  onClose,
  onConfirm,
}: CancelProDialogProps) {
  const [reason, setReason] = useState<CancelReason>();
  const [note, setNote] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onConfirm({ reason, note });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title="Cancel Pro?"
      description={`Pro stays active until ${until}. Nothing renews after that.`}
    >
      <form onSubmit={submit} className="mt-4">
        <p className="text-sm font-medium">After {until}</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-sub">
          <li>
            {FREE_PLAN.invoiceLimit} invoices a month instead of {PRO_PLAN.invoiceLimit}.
          </li>
          <li>Your invoices, clients and unused credits stay.</li>
        </ul>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Why are you cancelling? · Optional</legend>
          <div className="mt-2 grid gap-2">
            {cancelReasons.map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2.5 rounded-panel border border-line px-3.5 py-2.5 text-sm has-checked:border-accent has-checked:bg-soft"
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                  className="accent-(--accent)"
                />
                {cancelReasonLabels[value]}
              </label>
            ))}
          </div>
        </fieldset>

        <TextAreaField
          label="Anything we could do better? · Optional"
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          error={noteError}
        />

        <FormMessage>{error}</FormMessage>

        <div className="mt-5 flex flex-wrap justify-end gap-2.5">
          <Button type="submit" variant="secondary" pending={pending}>
            Yes, cancel Pro
          </Button>
          <Button type="button" onClick={onClose} disabled={pending}>
            Keep Pro
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
