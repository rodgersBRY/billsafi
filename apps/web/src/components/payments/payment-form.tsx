"use client";

import {
  correctPaymentSchema,
  type Invoice,
  type Payment,
  recordPaymentSchema,
  receivedPaymentMethodLabels,
  receivedPaymentMethods,
  type ReceivedPaymentMethod,
} from "@tallynest/contracts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";

interface PaymentFormProps {
  businessId: string;
  invoiceId: string;
  today: string;
  /** Prefills the amount when recording. */
  balanceDue: string;
  /** Correct this payment; omit to record a new one. */
  payment?: Payment;
  onSaved: (invoice: Invoice) => void;
  onCancel: () => void;
}

export function PaymentForm(props: PaymentFormProps) {
  const { payment } = props;
  const [values, setValues] = useState({
    amount: payment?.amount ?? props.balanceDue,
    paymentDate: payment?.paymentDate ?? props.today,
    method: (payment?.method ?? "mpesa") as ReceivedPaymentMethod,
    reference: payment?.reference ?? "",
    reason: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const set =
    (name: keyof typeof values) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((current) => ({ ...current, [name]: event.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const { reason, ...fields } = values;
    const body = payment ? { ...fields, reason } : fields;
    const parsed = (payment ? correctPaymentSchema : recordPaymentSchema).safeParse(body);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      );
      return;
    }
    setPending(true);
    setErrors({});
    const base = `/businesses/${props.businessId}/invoices/${props.invoiceId}/payments`;
    try {
      const invoice = await apiPost<Invoice>(
        payment ? `${base}/${payment.id}/correct` : base,
        body,
      );
      props.onSaved(invoice);
    } catch (error) {
      setErrors(
        error instanceof ApiError && error.issues.length
          ? error.fieldErrors()
          : { form: error instanceof ApiError ? error.message : "Something went wrong." },
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <TextField
        label="Amount received (KES)"
        inputMode="decimal"
        value={values.amount}
        error={errors.amount}
        onChange={set("amount")}
      />
      <TextField
        label="Payment date"
        type="date"
        max={props.today}
        value={values.paymentDate}
        error={errors.paymentDate}
        onChange={set("paymentDate")}
      />
      <SelectField label="Method" value={values.method} onChange={set("method")}>
        {receivedPaymentMethods.map((method) => (
          <option key={method} value={method}>
            {receivedPaymentMethodLabels[method]}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Reference · Optional"
        placeholder="For example the M-Pesa code"
        value={values.reference}
        error={errors.reference}
        onChange={set("reference")}
      />
      {payment && (
        <TextAreaField
          label="Reason for the correction"
          value={values.reason}
          error={errors.reason}
          onChange={set("reason")}
        />
      )}
      <FormMessage>{errors.form}</FormMessage>
      <div className="mt-6 flex justify-end gap-2.5">
        <Button type="button" variant="secondary" onClick={props.onCancel}>
          Cancel
        </Button>
        <Button type="submit" pending={pending}>
          {payment ? "Save correction" : "Save payment"}
        </Button>
      </div>
    </form>
  );
}

export function ReversePaymentForm({
  businessId,
  invoiceId,
  payment,
  onSaved,
  onCancel,
}: {
  businessId: string;
  invoiceId: string;
  payment: Payment;
  onSaved: (invoice: Invoice) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return setError("Reason is required");
    setPending(true);
    try {
      onSaved(
        await apiPost<Invoice>(
          `/businesses/${businessId}/invoices/${invoiceId}/payments/${payment.id}/reverse`,
          { reason },
        ),
      );
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <p className="mt-4 text-sm text-sub">
        The record is kept and marked reversed, and it stops counting toward the balance. This
        doesn&apos;t move any money.
      </p>
      <TextAreaField
        label="Reason for the reversal"
        placeholder="For example: duplicate entry, or recorded on the wrong invoice"
        value={reason}
        error={error}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="mt-6 flex justify-end gap-2.5">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Keep payment
        </Button>
        <Button type="submit" pending={pending}>
          Reverse payment
        </Button>
      </div>
    </form>
  );
}
