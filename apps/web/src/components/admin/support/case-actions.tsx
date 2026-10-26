"use client";

import {
  type AdminSupportCaseResult,
  type AdminSupportCaseRow,
  SUPPORT_RESOLUTION_MAX,
  SUPPORT_TITLE_MAX,
  supportCategories,
  supportSeverities,
  adminSupportResolveSchema,
} from "@billsafi/contracts";
import { CircleCheck, Pencil, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { ConfirmActionDialog } from "../confirm-action-dialog";
import { categoryLabels, severityLabels, supportStatusLabels } from "../status-badge";
import { FormActionDialog } from "../subscription-actions/form-action-dialog";
import { issuesByField } from "../subscription-actions/issues";

type Open = "edit" | "resolve" | "reopen" | null;

function EditDialog({
  row,
  selfId,
  onClose,
}: {
  row: AdminSupportCaseRow;
  selfId: string;
  onClose: () => void;
}) {
  const currentAssignee = row.assignedTo?.id ?? "";
  const [title, setTitle] = useState(row.title);
  const [status, setStatus] = useState(row.status === "waiting" ? "waiting" : "open");
  const [severity, setSeverity] = useState<string>(row.severity);
  const [category, setCategory] = useState<string>(row.category);
  const [assignee, setAssignee] = useState(currentAssignee);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const changes: Record<string, unknown> = {};
  if (title.trim() !== row.title) changes.title = title.trim();
  if (status !== row.status) changes.status = status;
  if (severity !== row.severity) changes.severity = severity;
  if (category !== row.category) changes.category = category;
  if (assignee !== currentAssignee) changes.assignedTo = assignee || null;
  const count = Object.keys(changes).length;

  function buildBody() {
    if (count === 0) {
      setErrors({ form: "Change at least one field." });
      return null;
    }
    setErrors({});
    return changes;
  }

  const others = row.assignedTo && row.assignedTo.id !== selfId ? row.assignedTo : null;
  return (
    <FormActionDialog<AdminSupportCaseResult>
      title="Edit case"
      method="PATCH"
      target={{ name: row.title, detail: row.account.email }}
      path={`/admin/support/cases/${encodeURIComponent(row.id)}`}
      submitLabel="Save changes"
      buildBody={buildBody}
      onServerIssues={(issues) => setErrors(issuesByField(issues))}
      preview={
        count === 0
          ? "No changes yet."
          : `${count} ${count === 1 ? "field" : "fields"} will change: ${Object.keys(changes).join(", ")}.`
      }
      successMessage={() => "Case updated."}
      onClose={onClose}
    >
      <TextField
        label="Title"
        value={title}
        maxLength={SUPPORT_TITLE_MAX}
        onChange={(event) => setTitle(event.target.value)}
        error={errors.title}
      />
      <SelectField
        label="Status"
        value={status}
        onChange={(event) => setStatus(event.target.value as "open" | "waiting")}
        error={errors.status}
      >
        <option value="open">{supportStatusLabels.open}</option>
        <option value="waiting">{supportStatusLabels.waiting}</option>
      </SelectField>
      <SelectField
        label="Severity"
        value={severity}
        onChange={(event) => setSeverity(event.target.value)}
        error={errors.severity}
      >
        {supportSeverities.map((value) => (
          <option key={value} value={value}>
            {severityLabels[value]}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Category"
        value={category}
        onChange={(event) => setCategory(event.target.value)}
        error={errors.category}
      >
        {supportCategories.map((value) => (
          <option key={value} value={value}>
            {categoryLabels[value]}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Assigned to"
        value={assignee}
        onChange={(event) => setAssignee(event.target.value)}
        error={errors.assignedTo}
      >
        <option value="">Nobody</option>
        <option value={selfId}>Me</option>
        {others && <option value={others.id}>{others.name || others.email}</option>}
      </SelectField>
      <FormMessage>{errors.form}</FormMessage>
    </FormActionDialog>
  );
}

function ResolveDialog({ row, onClose }: { row: AdminSupportCaseRow; onClose: () => void }) {
  const [resolution, setResolution] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function buildBody() {
    const parsed = adminSupportResolveSchema.safeParse({ resolution, reason: "placeholder" });
    const next = parsed.success ? {} : issuesByField(parsed.error.issues);
    setErrors(next);
    return Object.keys(next).length ? null : { resolution: resolution.trim() };
  }

  return (
    <FormActionDialog<AdminSupportCaseResult>
      title="Resolve case"
      target={{ name: row.title, detail: row.account.email }}
      path={`/admin/support/cases/${encodeURIComponent(row.id)}/resolve`}
      submitLabel="Resolve case"
      buildBody={buildBody}
      onServerIssues={(issues) => setErrors(issuesByField(issues))}
      preview="The case moves to Resolved and can't be edited until it is reopened."
      successMessage={() => "Case resolved."}
      onClose={onClose}
    >
      <TextAreaField
        label="How was it resolved?"
        value={resolution}
        maxLength={SUPPORT_RESOLUTION_MAX}
        onChange={(event) => setResolution(event.target.value)}
        error={errors.resolution}
      />
    </FormActionDialog>
  );
}

/** Edit, resolve and reopen for one case, each behind its own dialog. */
export function CaseActions({ row, selfId }: { row: AdminSupportCaseRow; selfId: string }) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const resolved = row.status === "resolved";
  const button = "min-h-11 md:min-h-0";
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {resolved ? (
          <Button type="button" className={button} onClick={() => setOpen("reopen")}>
            <RotateCcw aria-hidden className="size-4" />
            Reopen
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              className={button}
              onClick={() => setOpen("edit")}
            >
              <Pencil aria-hidden className="size-4" />
              Edit case
            </Button>
            <Button type="button" className={button} onClick={() => setOpen("resolve")}>
              <CircleCheck aria-hidden className="size-4" />
              Resolve
            </Button>
          </>
        )}
      </div>
      {open === "edit" && <EditDialog row={row} selfId={selfId} onClose={close} />}
      {open === "resolve" && <ResolveDialog row={row} onClose={close} />}
      <ConfirmActionDialog
        open={open === "reopen"}
        onClose={close}
        action={{
          title: "Reopen this case?",
          target: { name: row.title, detail: row.account.email },
          impact: [
            "The case goes back to Open and can be edited again.",
            "The resolution is kept as an automatic note.",
          ],
          confirmLabel: "Reopen case",
          path: `/admin/support/cases/${encodeURIComponent(row.id)}/reopen`,
          successMessage: "Case reopened.",
        }}
      />
    </>
  );
}
