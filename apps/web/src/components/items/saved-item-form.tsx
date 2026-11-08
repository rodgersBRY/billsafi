"use client";

import { createSavedItemSchema, type SavedItem } from "@billsafi/contracts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost, apiSend } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";

interface SavedItemFormProps {
  businessId: string;
  /** Edit this item; omit to create a new one. */
  item?: SavedItem;
  onSaved: (item: SavedItem) => void;
  onCancel: () => void;
}

export function SavedItemForm({ businessId, item, onSaved, onCancel }: SavedItemFormProps) {
  const [values, setValues] = useState({
    description: item?.description ?? "",
    quantity: item ? Number(item.quantity).toString() : "1",
    unitPrice: item?.unitPrice ?? "",
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
    const parsed = createSavedItemSchema.safeParse(values);
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
      const path = `/businesses/${businessId}/items`;
      const saved = item
        ? await apiSend<SavedItem>("PATCH", `${path}/${item.id}`, values)
        : await apiPost<SavedItem>(path, values);
      onSaved(saved);
    } catch (error) {
      setErrors(
        error instanceof ApiError && error.issues.length
          ? error.fieldErrors()
          : { form: error instanceof ApiError ? error.message : "Couldn't save. Try again." },
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <TextField label="Description" autoComplete="off" {...field("description")} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Default qty" inputMode="decimal" {...field("quantity")} />
        <TextField label="Unit price" inputMode="decimal" {...field("unitPrice")} />
      </div>
      <FormMessage>{errors.form}</FormMessage>
      <div className="mt-5 flex justify-end gap-2.5">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" pending={pending}>
          {item ? "Save changes" : "Add item"}
        </Button>
      </div>
    </form>
  );
}
