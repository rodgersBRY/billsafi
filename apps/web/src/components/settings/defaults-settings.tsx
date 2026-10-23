"use client";

import type { Business } from "@billsafi/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { apiRequest } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";

export function DefaultsSettings({ business }: { business: Business }) {
  const router = useRouter();
  const [terms, setTerms] = useState(String(business.defaultPaymentTermsDays));
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const days = Number(terms);
    if (!/^\d+$/.test(terms.trim()) || days > 365) {
      return setError("Enter a whole number of days from 0 to 365");
    }
    setPending(true);
    setError(undefined);
    try {
      await apiRequest<Business>(`/businesses/${business.id}`, {
        method: "PATCH",
        body: JSON.stringify({ defaultPaymentTermsDays: days }),
      });
      setSaved("Defaults saved.");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <h2 className="text-base font-semibold">Start every invoice with less typing</h2>
      <p className="mt-1 text-sm text-sub">Defaults for new invoices in this business.</p>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <SelectField
          label="Default currency"
          value={business.defaultCurrency}
          disabled
          hint="BillSafi invoices in Kenyan shillings for now."
        >
          <option value="KES">KES · Kenyan shilling</option>
        </SelectField>
        <TextField
          label="Default payment terms (days)"
          inputMode="numeric"
          value={terms}
          onChange={(event) => {
            setSaved(undefined);
            setTerms(event.target.value);
          }}
          error={error}
        />
      </div>
      <p className="mt-3 text-xs text-sub">
        These defaults apply to new invoices. You can change them per invoice.
      </p>
      <div aria-live="polite">
        <FormMessage tone="success">{saved}</FormMessage>
      </div>
      <div className="mt-5 flex justify-end">
        <Button type="submit" pending={pending}>
          Save defaults
        </Button>
      </div>
    </form>
  );
}
