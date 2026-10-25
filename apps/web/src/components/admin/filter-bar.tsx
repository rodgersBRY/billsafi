"use client";

import { LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { controlBase } from "@/components/ui/field";
import type { FilterField } from "./filter-fields";

const DEBOUNCE_MS = 300;

function fieldNames(field: FilterField): string[] {
  return field.type === "select" ? field.names : [field.name];
}

/** Which option the URL matches; the "any" option when none does. */
function selectedIndex(field: Extract<FilterField, { type: "select" }>, params: URLSearchParams) {
  const index = field.options.findIndex(
    (option) =>
      Object.keys(option.params).length > 0 &&
      field.names.every((name) => (params.get(name) ?? "") === (option.params[name] ?? "")),
  );
  return Math.max(index, 0);
}

/** Search and filters kept in the URL. Changing any filter goes back to page 1. */
export function FilterBar({ fields, label }: { fields: FilterField[]; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields
        .filter((field) => field.type !== "select")
        .map((field) => [field.name, searchParams.get(field.name) ?? ""]),
    ),
  );
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Typed text not yet in the URL, while a debounce is waiting. */
  const pendingText = useRef<Record<string, string>>({});
  useEffect(() => () => clearTimeout(timer.current), []);

  // The URL can change without typing: back and forward, "Clear filters" links, deep links.
  // Follow it, unless the user is mid-typing and their text is about to be applied.
  const urlKey = searchParams.toString();
  useEffect(() => {
    if (Object.keys(pendingText.current).length > 0) return;
    setDrafts(
      Object.fromEntries(
        fields
          .filter((field) => field.type !== "select")
          .map((field) => [field.name, new URLSearchParams(urlKey).get(field.name) ?? ""]),
      ),
    );
  }, [urlKey, fields]);

  const names = fields.flatMap(fieldNames);
  const active = names.filter((name) => searchParams.get(name)).length;

  function navigate(change: (params: URLSearchParams) => void) {
    clearTimeout(timer.current);
    const params = new URLSearchParams(searchParams.toString());
    // Typed text still waiting on its debounce goes along, so it isn't dropped.
    for (const [name, value] of Object.entries(pendingText.current)) {
      if (value.trim()) params.set(name, value.trim());
      else params.delete(name);
    }
    pendingText.current = {};
    change(params);
    params.delete("page");
    const text = params.toString();
    startTransition(() =>
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false }),
    );
  }

  function setText(name: string, value: string, delay: number) {
    setDrafts((current) => ({ ...current, [name]: value }));
    clearTimeout(timer.current);
    pendingText.current = { ...pendingText.current, [name]: value };
    const apply = () => navigate(() => {});
    if (delay) timer.current = setTimeout(apply, delay);
    else apply();
  }

  function clear() {
    pendingText.current = {};
    setDrafts((current) => Object.fromEntries(Object.keys(current).map((key) => [key, ""])));
    navigate((params) => names.forEach((name) => params.delete(name)));
  }

  return (
    <div role="search" aria-label={label} className="border-b border-line p-4">
      <div className="flex items-center justify-between gap-2 md:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-11 items-center gap-2 rounded-panel border border-line px-3 text-sm hover:bg-soft"
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          Filters{active > 0 && ` (${active} on)`}
        </button>
        {pending && <LoaderCircle aria-hidden className="size-4 animate-spin text-sub" />}
      </div>
      <div
        id={panelId}
        className={`${open ? "grid" : "hidden"} mt-3 grid-cols-1 gap-3 sm:grid-cols-2 md:mt-0 md:grid md:grid-cols-3 xl:grid-cols-6`}
      >
        {fields.map((field) => {
          const id = `${panelId}-${fieldNames(field).join("-")}`;
          const labelEl = (
            <label htmlFor={id} className="mb-1.5 block text-xs text-sub">
              {field.label}
            </label>
          );
          if (field.type === "select") {
            const index = selectedIndex(field, searchParams);
            return (
              <div key={id}>
                {labelEl}
                <select
                  id={id}
                  value={index}
                  onChange={(event) => {
                    const option = field.options[Number(event.target.value)]!;
                    navigate((params) => {
                      field.names.forEach((name) => params.delete(name));
                      Object.entries(option.params).forEach(([key, value]) =>
                        params.set(key, value),
                      );
                    });
                  }}
                  className={`${controlBase} min-h-11 md:min-h-0`}
                >
                  {field.options.map((option, optionIndex) => (
                    <option key={option.label} value={optionIndex}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }
          const isSearch = field.type === "search";
          return (
            <div key={id} className={isSearch ? "sm:col-span-2" : undefined}>
              {labelEl}
              <div className="relative">
                {isSearch && (
                  <Search aria-hidden className="absolute top-3.5 left-3 size-4 text-sub" />
                )}
                <input
                  id={id}
                  type={field.type === "date" ? "date" : isSearch ? "search" : "text"}
                  value={drafts[field.name] ?? ""}
                  placeholder={"placeholder" in field ? field.placeholder : undefined}
                  maxLength={100}
                  onChange={(event) =>
                    setText(field.name, event.target.value, field.type === "date" ? 0 : DEBOUNCE_MS)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setText(field.name, event.currentTarget.value, 0);
                  }}
                  className={`${controlBase} min-h-11 md:min-h-0 ${isSearch ? "pl-9" : ""}`}
                />
              </div>
            </div>
          );
        })}
        <div className="flex items-end gap-3">
          <button
            type="button"
            onClick={clear}
            disabled={active === 0}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-panel px-2 text-sm text-accent hover:bg-soft disabled:cursor-not-allowed disabled:text-sub disabled:opacity-60 md:min-h-10"
          >
            <X aria-hidden className="size-4" />
            Clear filters
          </button>
          {pending && (
            <span className="hidden items-center gap-1.5 text-xs text-sub md:inline-flex">
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
              Updating
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
