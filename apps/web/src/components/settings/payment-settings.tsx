"use client";

import {
  createPaymentInstructionSchema,
  type PaymentInstruction,
  type PaymentMethod,
  paymentMethodLabels,
  paymentMethods,
} from "@billsafi/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";
import { type Errors, issuesToErrors } from "./form-errors";

function editableNumber(instruction: PaymentInstruction | null): string {
  if (!instruction?.accountNumber) return "";
  const value = instruction.accountNumber;
  return value.startsWith("+254") ? `0${value.slice(4)}` : value;
}

export function PaymentSettings({
  businessId,
  current,
}: {
  businessId: string;
  current: PaymentInstruction | null;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>(current?.method ?? "mpesa_personal");
  const [accountNumber, setAccountNumber] = useState(() => editableNumber(current));
  const [instructions, setInstructions] = useState(current?.instructions ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState<string>();
  const [pending, setPending] = useState(false);

  const numberLabel =
    method === "mpesa_personal"
      ? "M-Pesa number"
      : method === "mpesa_till"
        ? "Till number"
        : "Paybill number";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const body =
      method === "bank_transfer"
        ? { method, instructions }
        : { method, accountNumber, instructions };
    const parsed = createPaymentInstructionSchema.safeParse(body);
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
    setPending(true);
    setErrors({});
    try {
      await apiPost(`/businesses/${businessId}/payment-instructions`, body);
      setSaved("Instructions saved. New invoices show them.");
      router.refresh();
    } catch (error) {
      setErrors(
        error instanceof ApiError && error.issues.length
          ? error.fieldErrors()
          : { form: "Something went wrong. Please try again." },
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <h2 className="text-base font-semibold">How clients pay you</h2>
      <p className="mt-1 text-sm text-sub">Instructions for payments made outside Billsafi.</p>
      <SelectField
        label="Payment method"
        value={method}
        onChange={(event) => {
          setSaved(undefined);
          setErrors({});
          setMethod(event.target.value as PaymentMethod);
        }}
      >
        {paymentMethods.map((value) => (
          <option key={value} value={value}>
            {paymentMethodLabels[value]}
          </option>
        ))}
      </SelectField>
      {method !== "bank_transfer" && (
        <TextField
          label={numberLabel}
          inputMode="numeric"
          placeholder={method === "mpesa_personal" ? "07XX XXX XXX" : "Business number"}
          value={accountNumber}
          onChange={(event) => {
            setSaved(undefined);
            setAccountNumber(event.target.value);
          }}
          error={errors.accountNumber}
        />
      )}
      <TextAreaField
        label={
          method === "bank_transfer" ? "Bank transfer details" : "Payment instructions · Optional"
        }
        placeholder={
          method === "bank_transfer"
            ? "Bank, account name, account number and branch"
            : "Please include your invoice number when notifying us of payment."
        }
        value={instructions}
        onChange={(event) => {
          setSaved(undefined);
          setInstructions(event.target.value);
        }}
        error={errors.instructions}
      />
      <p className="mt-3 rounded-panel bg-soft p-3.5 text-xs text-sub">
        Your payment number can differ from your business contact number. These instructions are for
        your clients; your Billsafi Pro subscription is managed separately in Billing.
      </p>
      <div aria-live="polite">
        <FormMessage>{errors.form}</FormMessage>
        <FormMessage tone="success">{saved}</FormMessage>
      </div>
      <div className="mt-5 flex justify-end">
        <Button type="submit" pending={pending}>
          Save instructions
        </Button>
      </div>
    </form>
  );
}
