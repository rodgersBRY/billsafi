"use client";

import { INVOICE_LIMITS } from "@billsafi/contracts";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { type EditorItem, newItem } from "./editor-items";

export interface LineItemsFieldsProps {
  items: EditorItem[];
  onChange: (items: EditorItem[]) => void;
  errors: Record<string, string>;
  /**
   * Prepended to every error key this component reads, e.g. `items.0.description`.
   * The public invoice generator nests invoice errors under `invoice.`.
   */
  errorPrefix?: string;
}

export function LineItemsFields({
  items,
  onChange,
  errors,
  errorPrefix = "",
}: LineItemsFieldsProps) {
  function updateItem(key: number, field: keyof Omit<EditorItem, "key">, value: string) {
    onChange(items.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  }

  return (
    <>
      {errors[`${errorPrefix}items`] && (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">
          {errors[`${errorPrefix}items`]}
        </p>
      )}
      <ol className="mt-2">
        {items.map((item, index) => {
          const n = index + 1;
          return (
            <li
              key={item.key}
              aria-label={`Line item ${n}`}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-x-2 border-b border-line pb-3.5 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_auto]"
            >
              <div className="col-span-2 sm:col-span-1">
                <TextField
                  label={n === 1 ? "Description" : `Description ${n}`}
                  value={item.description}
                  error={errors[`${errorPrefix}items.${index}.description`]}
                  onChange={(event) => updateItem(item.key, "description", event.target.value)}
                />
              </div>
              <TextField
                label={n === 1 ? "Qty" : `Qty ${n}`}
                inputMode="decimal"
                value={item.quantity}
                error={errors[`${errorPrefix}items.${index}.quantity`]}
                onChange={(event) => updateItem(item.key, "quantity", event.target.value)}
              />
              <TextField
                label={n === 1 ? "Unit price" : `Unit price ${n}`}
                inputMode="decimal"
                value={item.unitPrice}
                error={errors[`${errorPrefix}items.${index}.unitPrice`]}
                onChange={(event) => updateItem(item.key, "unitPrice", event.target.value)}
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((row) => row.key !== item.key))}
                className="col-start-3 row-start-1 mt-10 rounded-lg p-1.5 text-sub hover:bg-soft hover:text-ink sm:col-start-auto sm:row-start-auto"
              >
                <X aria-hidden className="size-4" />
                <span className="sr-only">Remove line item {n}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <Button
        type="button"
        variant="ghost"
        className="mt-3"
        disabled={items.length >= INVOICE_LIMITS.maxItems}
        onClick={() => onChange([...items, newItem()])}
      >
        <Plus aria-hidden className="size-4" />
        Add line item
      </Button>
    </>
  );
}
