"use client";

import { INVOICE_LIMITS, type SavedItem } from "@billsafi/contracts";
import { BookmarkPlus, CircleCheck, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ItemCombobox } from "@/components/items/item-combobox";
import { useSavedItems } from "@/components/items/use-saved-items";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { type EditorItem, newItem } from "./editor-items";

const PRICE = /^\d+(\.\d{1,2})?$/;

export interface LineItemsFieldsProps {
  /** Turns on saved item suggestions and inline saving. The guest generator leaves it out. */
  businessId?: string;
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
  businessId,
  items,
  onChange,
  errors,
  errorPrefix = "",
}: LineItemsFieldsProps) {
  const saved = useSavedItems(businessId);
  const [saveStatus, setSaveStatus] = useState<
    Record<number, { pending?: boolean; error?: string; limitReached?: boolean }>
  >({});
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  function notify(message: string) {
    clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }

  function updateItem(key: number, patch: Partial<Omit<EditorItem, "key">>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function pick(key: number, option: SavedItem) {
    updateItem(key, {
      description: option.description,
      quantity: Number(option.quantity).toString(),
      unitPrice: option.unitPrice,
      savedItemId: option.id,
    });
  }

  function canSave(item: EditorItem) {
    const description = item.description.trim().toLowerCase();
    return (
      businessId !== undefined &&
      item.savedItemId === null &&
      description !== "" &&
      PRICE.test(item.unitPrice.trim()) &&
      !saved.items.some((option) => option.description.toLowerCase() === description)
    );
  }

  async function saveItem(item: EditorItem) {
    setSaveStatus((current) => ({ ...current, [item.key]: { pending: true } }));
    const result = await saved.save({
      description: item.description,
      quantity: "1",
      unitPrice: item.unitPrice.trim(),
    });
    if ("item" in result) {
      setSaveStatus((current) => {
        const next = { ...current };
        delete next[item.key];
        return next;
      });
      updateItem(item.key, { savedItemId: result.item.id });
      notify(`“${result.item.description}” saved. Pick it from the list next time.`);
    } else {
      setSaveStatus((current) => ({ ...current, [item.key]: result }));
    }
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
                {businessId ? (
                  <ItemCombobox
                    label={n === 1 ? "Description" : `Description ${n}`}
                    value={item.description}
                    error={errors[`${errorPrefix}items.${index}.description`]}
                    options={saved.items}
                    onType={(description) =>
                      updateItem(item.key, { description, savedItemId: null })
                    }
                    onPick={(option) => pick(item.key, option)}
                  />
                ) : (
                  <TextField
                    label={n === 1 ? "Description" : `Description ${n}`}
                    value={item.description}
                    error={errors[`${errorPrefix}items.${index}.description`]}
                    onChange={(event) => updateItem(item.key, { description: event.target.value })}
                  />
                )}
              </div>
              <TextField
                label={n === 1 ? "Qty" : `Qty ${n}`}
                inputMode="decimal"
                value={item.quantity}
                error={errors[`${errorPrefix}items.${index}.quantity`]}
                onChange={(event) => updateItem(item.key, { quantity: event.target.value })}
              />
              <TextField
                label={n === 1 ? "Unit price" : `Unit price ${n}`}
                inputMode="decimal"
                value={item.unitPrice}
                error={errors[`${errorPrefix}items.${index}.unitPrice`]}
                onChange={(event) => updateItem(item.key, { unitPrice: event.target.value })}
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((row) => row.key !== item.key))}
                className="col-start-3 row-start-1 mt-10 rounded-lg p-1.5 text-sub hover:bg-soft hover:text-ink sm:col-start-auto sm:row-start-auto"
              >
                <X aria-hidden className="size-4" />
                <span className="sr-only">Remove line item {n}</span>
              </button>
              {businessId && (
                <SavedItemStatus
                  n={n}
                  businessId={businessId}
                  canSave={canSave(item)}
                  status={saveStatus[item.key]}
                  onSave={() => saveItem(item)}
                />
              )}
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
      {businessId && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6"
        >
          {notice && (
            <div className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-panel border border-teal bg-teal px-4 py-3 text-sm font-medium text-white shadow-lg">
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
              <p className="flex-1">{notice}</p>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="-m-1 grid size-11 place-items-center rounded-md text-white/80 hover:bg-white/15 hover:text-white md:size-7"
              >
                <X aria-hidden className="size-4" />
                <span className="sr-only">Dismiss</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

interface SavedItemStatusProps {
  n: number;
  businessId: string;
  canSave: boolean;
  status?: { pending?: boolean; error?: string; limitReached?: boolean };
  onSave: () => void;
}

function SavedItemStatus({ n, businessId, canSave, status, onSave }: SavedItemStatusProps) {
  if (status?.error) {
    return (
      <p role="alert" className="col-span-full mt-2 text-xs text-red-700 dark:text-red-300">
        {status.error}{" "}
        {status.limitReached && (
          <Link href={`/${businessId}/billing`} className="underline">
            Upgrade
          </Link>
        )}
      </p>
    );
  }
  if (!canSave) return null;
  return (
    <div className="col-span-full">
      <Button
        type="button"
        variant="suggest"
        className="mt-2 gap-1.5 px-2.5 py-1.5 text-xs"
        pending={status?.pending}
        onClick={onSave}
      >
        <BookmarkPlus aria-hidden className="size-3.5" />
        Save item
        <span className="sr-only"> {n}</span>
        <span className="font-normal text-sub">to reuse it</span>
      </Button>
    </div>
  );
}
