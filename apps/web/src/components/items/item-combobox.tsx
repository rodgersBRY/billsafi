"use client";

import type { SavedItem } from "@billsafi/contracts";
import { useId, useMemo, useState } from "react";
import { controlBase, describedBy, FieldShell } from "@/components/ui/field";
import { formatAmount } from "@/lib/format";

const MAX_OPTIONS = 8;

interface ItemComboboxProps {
  label: string;
  value: string;
  error?: string;
  options: SavedItem[];
  onType: (value: string) => void;
  onPick: (item: SavedItem) => void;
}

/** A description input that suggests saved items as you type. */
export function ItemCombobox({ label, value, error, options, onType, onPick }: ItemComboboxProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    return options
      .filter((item) => !query || item.description.toLowerCase().includes(query))
      .filter((item) => item.description.toLowerCase() !== query)
      .slice(0, MAX_OPTIONS);
  }, [options, value]);

  const expanded = open && matches.length > 0;

  function pick(item: SavedItem) {
    onPick(item);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (expanded ? (index + 1) % matches.length : 0));
    } else if (event.key === "ArrowUp" && expanded) {
      event.preventDefault();
      setActive((index) => (index - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter" && expanded) {
      event.preventDefault();
      pick(matches[active]!);
    } else if (event.key === "Escape" && expanded) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <FieldShell id={id} label={label} error={error}>
      <div className="relative mt-1.5">
        <input
          id={id}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, undefined, error)}
          className={controlBase}
          value={value}
          onChange={(event) => {
            onType(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Saved items"
          hidden={!expanded}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-panel border border-line bg-panel py-1 shadow-lg"
        >
          {matches.map((item, index) => (
            <li
              key={item.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // Keep focus in the input so blur doesn't close the list before the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(item)}
              onMouseEnter={() => setActive(index)}
              className="flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm aria-selected:bg-soft"
            >
              <span className="min-w-0 wrap-anywhere">{item.description}</span>
              <span className="shrink-0 text-xs text-sub tabular-nums">
                {formatAmount(item.unitPrice)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </FieldShell>
  );
}
