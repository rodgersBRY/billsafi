"use client";

import {
  type AdminActionAck,
  type AdminWhatsNewEntry,
  WHATS_NEW_BODY_MAX,
  WHATS_NEW_TITLE_MAX,
  whatsNewEntryInputSchema,
  whatsNewLinkLabels,
  whatsNewLinkSegments,
} from "@billsafi/contracts";
import { useState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { WhatsNewEntryCard } from "@/components/whats-new/whats-new-entry";
import { FormActionDialog } from "../subscription-actions/form-action-dialog";
import { issuesByField } from "../subscription-actions/issues";

/** An ISO instant as the Nairobi wall-clock value a datetime-local input takes. */
function toInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 16);
}

/** A datetime-local value read as Nairobi time (+03:00). */
function fromInput(value: string): string | undefined {
  return value ? `${value}:00+03:00` : undefined;
}

/** Creates an entry, or edits one when `entry` is given. Mount only while open. */
export function EntryDialog({
  entry,
  onClose,
}: {
  entry?: AdminWhatsNewEntry;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [body, setBody] = useState(entry?.body ?? "");
  const [linkSegment, setLinkSegment] = useState<string>(entry?.linkSegment ?? "");
  const [pro, setPro] = useState(entry?.pro ?? false);
  const [popup, setPopup] = useState(entry?.popup ?? false);
  const [publishedAt, setPublishedAt] = useState(toInput(entry?.publishedAt ?? null));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function buildBody() {
    const value = {
      title: title.trim(),
      body: body.trim(),
      ...(linkSegment ? { linkSegment } : {}),
      pro,
      popup,
      ...(publishedAt ? { publishedAt: fromInput(publishedAt) } : {}),
    };
    const parsed = whatsNewEntryInputSchema.safeParse(value);
    const next = parsed.success ? {} : issuesByField(parsed.error.issues);
    setErrors(next);
    return Object.keys(next).length ? null : value;
  }

  const segment = whatsNewLinkSegments.find((s) => s === linkSegment) ?? null;

  return (
    <FormActionDialog<AdminWhatsNewEntry | AdminActionAck>
      title={entry ? "Edit entry" : "New entry"}
      target={{
        name: entry?.title ?? "New What's new entry",
        detail: entry ? `Status: ${entry.status}` : "Saved as a draft unless a publish time is set",
      }}
      path={entry ? `/admin/whats-new/${entry.id}` : "/admin/whats-new"}
      method={entry ? "PUT" : "POST"}
      submitLabel="Save"
      buildBody={buildBody}
      onServerIssues={(issues) => setErrors(issuesByField(issues))}
      successMessage={() => "Entry saved."}
      preview={
        <div className="space-y-2">
          <p className="text-xs text-sub">Preview for a Free user</p>
          <div className="rounded-panel bg-background p-3">
            <WhatsNewEntryCard
              preview
              title={title.trim() || "Your title appears here."}
              body={body.trim() || "Your text appears here."}
              linkSegment={segment}
              pro={pro}
              publishedAt={fromInput(publishedAt) ?? null}
              unread
              businessId="preview"
              isPro={false}
            />
          </div>
        </div>
      }
      onClose={onClose}
    >
      <TextField
        label="Title"
        value={title}
        maxLength={WHATS_NEW_TITLE_MAX}
        onChange={(event) => setTitle(event.target.value)}
        error={errors.title}
        hint={`${title.length} of ${WHATS_NEW_TITLE_MAX}`}
      />
      <TextAreaField
        label="Text"
        rows={4}
        value={body}
        maxLength={WHATS_NEW_BODY_MAX}
        onChange={(event) => setBody(event.target.value)}
        error={errors.body}
        hint={`${body.length} of ${WHATS_NEW_BODY_MAX}`}
      />
      <SelectField
        label="Link to page"
        value={linkSegment}
        onChange={(event) => setLinkSegment(event.target.value)}
        error={errors.linkSegment}
      >
        <option value="">No link</option>
        {whatsNewLinkSegments.map((value) => (
          <option key={value} value={value}>
            {whatsNewLinkLabels[value]}
          </option>
        ))}
      </SelectField>
      <label className="mt-4 flex min-h-11 items-center gap-2 text-sm md:min-h-0">
        <input
          type="checkbox"
          checked={pro}
          onChange={(event) => setPro(event.target.checked)}
          className="size-4 accent-teal"
        />
        Pro feature
      </label>
      <label className="mt-2 flex min-h-11 items-center gap-2 text-sm md:min-h-0">
        <input
          type="checkbox"
          checked={popup}
          onChange={(event) => setPopup(event.target.checked)}
          className="size-4 accent-teal"
        />
        Pop up on next visit
      </label>
      <TextField
        label="Publish at (Nairobi time)"
        type="datetime-local"
        value={publishedAt}
        onChange={(event) => setPublishedAt(event.target.value)}
        error={errors.publishedAt}
        hint="Leave empty to keep it a draft."
      />
    </FormActionDialog>
  );
}
