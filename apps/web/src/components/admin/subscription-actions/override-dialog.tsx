"use client";

import {
  ADMIN_OVERRIDE_MAX_EXTRA,
  type AdminOverrideResult,
  adminOverrideSchema,
} from "@billsafi/contracts";
import { useState } from "react";
import { TextField } from "@/components/ui/field";
import { formatDate } from "@/lib/format";
import { formatCount } from "../admin-format";
import type { ActionContext } from "./action-context";
import { FormActionDialog } from "./form-action-dialog";
import { issuesByField } from "./issues";
import { nairobiDayAfter, nairobiDayStartIso, nairobiToday } from "./preview";

/** Raises the account's invoice limit for a while. An expiry is required. */
export function OverrideDialog({
  context,
  onClose,
}: {
  context: ActionContext;
  onClose: () => void;
}) {
  const today = nairobiToday();
  const latest = nairobiDayAfter(365);
  const [extra, setExtra] = useState("10");
  const [startsOn, setStartsOn] = useState("");
  const [expiresOn, setExpiresOn] = useState(nairobiDayAfter(30));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const count = Number(extra);
  const valid = Number.isInteger(count) && count >= 1 && count <= ADMIN_OVERRIDE_MAX_EXTRA;
  // Today (or blank) means "from now"; a later day starts at its Nairobi midnight.
  const startsLater = Boolean(startsOn) && startsOn > today;

  const preview =
    !valid || !expiresOn
      ? "Enter the extra invoices and an expiry to see the result."
      : startsLater
        ? `From ${formatDate(startsOn)}, the limit rises by ${formatCount(count)} until ${formatDate(expiresOn)}.`
        : `The limit becomes ${formatCount(context.limit + count)} (now ${formatCount(context.limit)}) until ${formatDate(expiresOn)}.`;

  function buildBody() {
    const body = {
      extraInvoices: count,
      ...(startsLater ? { startsAt: nairobiDayStartIso(startsOn) } : {}),
      expiresAt: expiresOn ? nairobiDayStartIso(expiresOn) : "",
    };
    const parsed = adminOverrideSchema.safeParse({ ...body, reason: "placeholder reason" });
    const next = parsed.success ? {} : issuesByField(parsed.error.issues);
    setErrors(next);
    return Object.keys(next).length ? null : body;
  }

  return (
    <FormActionDialog<AdminOverrideResult>
      title="Add a limit override"
      target={context.target}
      path={`/admin/tenants/${encodeURIComponent(context.target.id)}/overrides`}
      submitLabel="Add override"
      buildBody={buildBody}
      onServerIssues={(issues) => setErrors(issuesByField(issues))}
      preview={preview}
      successMessage={(response) =>
        `Override added. The limit is ${formatCount(response.allowance.limit)} in the current window.`
      }
      onClose={onClose}
    >
      <TextField
        label="Extra invoices"
        type="number"
        inputMode="numeric"
        min={1}
        max={ADMIN_OVERRIDE_MAX_EXTRA}
        value={extra}
        onChange={(event) => setExtra(event.target.value)}
        error={errors.extraInvoices}
        hint={`1 to ${formatCount(ADMIN_OVERRIDE_MAX_EXTRA)}, on top of the plan limit`}
      />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <TextField
          label="Starts on (optional)"
          type="date"
          min={today}
          max={latest}
          value={startsOn}
          onChange={(event) => setStartsOn(event.target.value)}
          error={errors.startsAt}
          hint="Blank or today starts now"
        />
        <TextField
          label="Ends on"
          type="date"
          min={today}
          max={latest}
          value={expiresOn}
          onChange={(event) => setExpiresOn(event.target.value)}
          error={errors.expiresAt}
          hint="At the start of that day. At most a year away."
        />
      </div>
    </FormActionDialog>
  );
}
