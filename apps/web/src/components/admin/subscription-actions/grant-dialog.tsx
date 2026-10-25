"use client";

import {
  ADMIN_GRANT_MAX_CREDITS,
  ADMIN_GRANT_MAX_MONTHS,
  type AccountGrantKind,
  type AdminGrantRecorded,
  adminGrantSchema,
} from "@billsafi/contracts";
import { useState } from "react";
import { TextField } from "@/components/ui/field";
import { formatCount, formatDay } from "../admin-format";
import type { ActionContext } from "./action-context";
import { FormActionDialog } from "./form-action-dialog";
import { issuesByField } from "./issues";
import { proUntilAfter } from "./preview";

interface GrantDialogProps {
  kind: AccountGrantKind;
  context: ActionContext;
  onClose: () => void;
}

/** A gift at no charge: Pro months or invoice credits. Never counted as revenue. */
export function GrantDialog({ kind, context, onClose }: GrantDialogProps) {
  const pro = kind === "pro_months";
  const max = pro ? ADMIN_GRANT_MAX_MONTHS : ADMIN_GRANT_MAX_CREDITS;
  const [quantity, setQuantity] = useState(pro ? "1" : "50");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const count = Number(quantity);
  const valid = Number.isInteger(count) && count >= 1 && count <= max;

  const preview = !valid
    ? `Enter a whole number from 1 to ${formatCount(max)}.`
    : pro
      ? `Pro will run until ${formatDay(proUntilAfter(context.pro, count).toISOString())}. A gift, so it is never counted as revenue.`
      : `Credits will go from ${formatCount(context.credits)} to ${formatCount(context.credits + count)}. A gift, so it is never counted as revenue.`;

  function buildBody() {
    const body = { kind, quantity: count };
    const parsed = adminGrantSchema.safeParse({ ...body, reason: "placeholder reason" });
    const next = parsed.success ? {} : issuesByField(parsed.error.issues);
    setErrors(next);
    return Object.keys(next).length ? null : body;
  }

  return (
    <FormActionDialog<AdminGrantRecorded>
      title={pro ? "Grant Pro months" : "Grant invoice credits"}
      target={context.target}
      path={`/admin/tenants/${encodeURIComponent(context.target.id)}/grants`}
      idempotent
      submitLabel={pro ? "Grant Pro months" : "Grant credits"}
      buildBody={buildBody}
      onServerIssues={(issues) => setErrors(issuesByField(issues))}
      preview={preview}
      successMessage={(response) =>
        response.replayed
          ? "This gift was already given. Nothing was added twice."
          : pro && response.subscription.paidUntil
            ? `Pro months granted. Pro runs until ${formatDay(response.subscription.paidUntil)}.`
            : `Credits granted. The account has ${formatCount(response.subscription.credits)} credits.`
      }
      onClose={onClose}
    >
      <TextField
        label={pro ? "Pro months" : "Invoice credits"}
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        error={errors.quantity}
        hint={`1 to ${formatCount(max)}`}
      />
    </FormActionDialog>
  );
}
