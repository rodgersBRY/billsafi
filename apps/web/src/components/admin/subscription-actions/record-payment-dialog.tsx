"use client";

import {
  ADMIN_PAYMENT_MAX_MONTHS,
  ADMIN_PAYMENT_MAX_PACKS,
  type AdminPaymentRecorded,
  adminRecordPaymentSchema,
  manualPaymentCurrencies,
  manualPaymentMethods,
} from "@billsafi/contracts";
import { CREDIT_PACK, PRO_PLAN } from "@billsafi/domain";
import { useState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { formatCount, formatDay } from "../admin-format";
import { methodLabels } from "../subscriptions/subscription-text";
import type { ActionContext } from "./action-context";
import { FormActionDialog } from "./form-action-dialog";
import { issuesByField } from "./issues";
import { nairobiToday, proUntilAfter } from "./preview";

type Purpose = "pro_month" | "invoice_credits";

/** Records money received outside M-Pesa checkout: Pro months or credit packs. */
export function RecordPaymentDialog({
  context,
  onClose,
}: {
  context: ActionContext;
  onClose: () => void;
}) {
  const today = nairobiToday();
  const [purpose, setPurpose] = useState<Purpose>("pro_month");
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>("KES");
  const [method, setMethod] = useState<string>("mpesa_direct");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const count = Number(quantity);
  const max = purpose === "pro_month" ? ADMIN_PAYMENT_MAX_MONTHS : ADMIN_PAYMENT_MAX_PACKS;
  const validCount = Number.isInteger(count) && count >= 1 && count <= max;
  const preview = !validCount
    ? "Enter how many to see the result."
    : purpose === "pro_month"
      ? `Pro will run until ${formatDay(proUntilAfter(context.pro, count).toISOString())}. Counts as revenue in ${currency}, on the day paid.`
      : `Credits will go from ${formatCount(context.credits)} to ${formatCount(context.credits + count * CREDIT_PACK.invoices)}. Counts as revenue in ${currency}, on the day paid.`;

  function buildBody() {
    const body = {
      purpose,
      ...(purpose === "pro_month" ? { months: count } : { packs: count }),
      amount,
      currency,
      method,
      reference,
      paidAt,
      note,
    };
    const parsed = adminRecordPaymentSchema.safeParse({ ...body, reason: "placeholder reason" });
    const next = parsed.success ? {} : issuesByField(parsed.error.issues);
    setErrors(next);
    return Object.keys(next).length ? null : body;
  }

  return (
    <FormActionDialog<AdminPaymentRecorded>
      title="Record a payment"
      target={context.target}
      path={`/admin/tenants/${encodeURIComponent(context.target.id)}/payments`}
      idempotent
      submitLabel="Record payment"
      buildBody={buildBody}
      onServerIssues={(issues) => setErrors(issuesByField(issues))}
      preview={preview}
      successMessage={(response) =>
        response.replayed
          ? "This payment was already recorded. Nothing was added twice."
          : response.subscription.paidUntil && purpose === "pro_month"
            ? `Payment recorded. Pro runs until ${formatDay(response.subscription.paidUntil)}.`
            : `Payment recorded. The account has ${formatCount(response.subscription.credits)} credits.`
      }
      onClose={onClose}
    >
      <div className="grid gap-x-3 sm:grid-cols-2">
        <SelectField
          label="For"
          value={purpose}
          onChange={(event) => setPurpose(event.target.value as Purpose)}
        >
          <option value="pro_month">Pro months</option>
          <option value="invoice_credits">
            Credit packs ({CREDIT_PACK.invoices} invoices each)
          </option>
        </SelectField>
        <TextField
          label={purpose === "pro_month" ? "Months" : "Packs"}
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          error={errors.months ?? errors.packs}
          hint={`1 to ${max}`}
        />
        <TextField
          label="Amount paid"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={errors.amount}
          hint={
            purpose === "pro_month"
              ? `Pro lists at USD ${PRO_PLAN.priceUsd} a month`
              : `A pack lists at USD ${CREDIT_PACK.priceUsd}`
          }
        />
        <SelectField
          label="Currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          error={errors.currency}
        >
          {manualPaymentCurrencies.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Method"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          error={errors.method}
        >
          {manualPaymentMethods.map((value) => (
            <option key={value} value={value}>
              {methodLabels[value]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Reference"
          value={reference}
          maxLength={100}
          onChange={(event) => setReference(event.target.value)}
          error={errors.reference}
          hint="M-Pesa code, bank reference or receipt number"
        />
        <TextField
          label="Date paid (Nairobi)"
          type="date"
          max={today}
          value={paidAt}
          onChange={(event) => setPaidAt(event.target.value)}
          error={errors.paidAt}
        />
      </div>
      <TextAreaField
        label="Note (optional, admins only)"
        rows={2}
        maxLength={500}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        error={errors.note}
      />
    </FormActionDialog>
  );
}
