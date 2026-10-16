"use client";

import { type Client, createClientSchema } from "@tallynest/contracts";
import { ChevronDown, Info } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost, apiSend } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";

interface ClientFormProps {
  businessId: string;
  /** Edit this client; omit to create a new one. */
  client?: Client;
  onSaved: (client: Client) => void;
  onCancel: () => void;
}

function display(phone: string) {
  return phone.startsWith("+254") ? `0${phone.slice(4)}` : phone;
}

export function ClientForm({ businessId, client, onSaved, onCancel }: ClientFormProps) {
  const [values, setValues] = useState({
    name: client?.name ?? "",
    phone: client ? display(client.phone) : "",
    email: client?.email ?? "",
    companyName: client?.companyName ?? "",
    address: client?.address ?? "",
    kraPin: client?.kraPin ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const field = (name: keyof typeof values) => ({
    value: values[name],
    error: errors[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [name]: event.target.value })),
  });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = createClientSchema.safeParse(values);
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
    try {
      const path = `/businesses/${businessId}/clients`;
      const saved = client
        ? await apiSend<Client>("PATCH", `${path}/${client.id}`, values)
        : await apiPost<Client>(path, values);
      onSaved(saved);
    } catch (error) {
      setErrors(
        error instanceof ApiError && error.issues.length
          ? error.fieldErrors()
          : { form: "We couldn't save this client. Please try again." },
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <p className="mt-4 text-xs text-sub">Name and phone are required.</p>
      <TextField label="Client name" autoComplete="off" {...field("name")} />
      <TextField label="Phone" type="tel" placeholder="07XX XXX XXX" {...field("phone")} />
      <TextField label="Email · Optional" type="email" {...field("email")} />
      <TextField label="Company name · Optional" {...field("companyName")} />
      <details className="group mt-4 text-sub" open={Boolean(client?.address || client?.kraPin)}>
        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs">
          <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
          More details · Optional
        </summary>
        <TextField label="Address" {...field("address")} />
        <TextField label="KRA PIN" {...field("kraPin")} />
      </details>
      {client && (
        <p className="mt-4 flex gap-2 rounded-panel bg-soft p-3 text-xs text-sub">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0 text-teal" />
          Changes apply to the saved client profile. Existing invoices keep their original client
          details.
        </p>
      )}
      <FormMessage>{errors.form}</FormMessage>
      <div className="mt-6 flex justify-end gap-2.5">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" pending={pending}>
          Save client
        </Button>
      </div>
    </form>
  );
}
