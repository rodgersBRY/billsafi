"use client";

import { SUPPORT_NOTE_MAX } from "@billsafi/contracts";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { controlBase } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { ApiError } from "@/lib/api-error";
import { apiPost } from "@/lib/api.client";
import { useAdminToast } from "../admin-toast";

/** Add-note form. Notes are plain text, append-only and never shown to the account owner. */
export function NoteBox({ path, label = "Add a note" }: { path: string; label?: string }) {
  const router = useRouter();
  const toast = useAdminToast();
  const id = useId();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const busy = submitting || refreshing;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return setError("Write a note.");
    if (busy) return;
    setSubmitting(true);
    setError("");
    try {
      await apiPost(path, { body: text });
    } catch (caught) {
      setSubmitting(false);
      setError(
        caught instanceof ApiError && [400, 404, 409, 429].includes(caught.status)
          ? (caught.issues[0]?.message ?? caught.message)
          : "That didn't go through. The note was not saved. Try again.",
      );
      return;
    }
    setSubmitting(false);
    setBody("");
    startTransition(() => router.refresh());
    toast({ tone: "success", message: "Note added." });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        maxLength={SUPPORT_NOTE_MAX}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        aria-invalid={error ? true : undefined}
        className={`mt-1.5 ${controlBase}`}
      />
      <FormMessage>{error}</FormMessage>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-sub">
          {body.length} of {SUPPORT_NOTE_MAX}. Internal only.
        </p>
        <Button type="submit" pending={busy} className="min-h-11 md:min-h-0">
          Add note
        </Button>
      </div>
    </form>
  );
}
