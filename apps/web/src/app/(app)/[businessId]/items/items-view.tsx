"use client";

import type { SavedItem } from "@billsafi/contracts";
import { Archive, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SavedItemForm } from "@/components/items/saved-item-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost } from "@/lib/api.client";
import { formatAmount } from "@/lib/format";

interface ItemsViewProps {
  businessId: string;
  items: SavedItem[];
  status: "active" | "archived";
  search: string;
}

type Editing = { mode: "create" } | { mode: "edit"; item: SavedItem } | null;

export function ItemsView({ businessId, items, status, search }: ItemsViewProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [archiving, setArchiving] = useState<SavedItem | null>(null);
  const [archiveError, setArchiveError] = useState("");
  const [pending, setPending] = useState(false);

  const base = `/${businessId}/items`;
  const href = (next: { status?: string; q?: string }) => {
    const params = new URLSearchParams();
    if ((next.status ?? status) === "archived") params.set("status", "archived");
    const q = next.q ?? search;
    if (q) params.set("q", q);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  };

  function onSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    router.replace(href({ q }));
  }

  async function confirmArchive() {
    if (!archiving) return;
    setPending(true);
    setArchiveError("");
    try {
      await apiPost(`/businesses/${businessId}/items/${archiving.id}/archive`, {});
      setArchiving(null);
      router.refresh();
    } catch {
      setArchiveError("Couldn't archive this item. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3.5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Items</h1>
          <p className="mt-1.25 text-sm text-sub">Pick these from the line item list.</p>
        </div>
        <Button type="button" onClick={() => setEditing({ mode: "create" })}>
          <Plus aria-hidden className="size-4" />
          Add item
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form role="search" method="get" onSubmit={onSearch} className="relative w-full max-w-67.5">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-sub"
          />
          <input
            name="q"
            type="search"
            defaultValue={search}
            aria-label="Search items"
            placeholder="Search items"
            className="w-full rounded-panel border border-line bg-panel py-2.5 pr-2.5 pl-8.5 text-sm"
          />
        </form>
        <nav aria-label="Item status" className="flex gap-1.5">
          {(["active", "archived"] as const).map((value) => (
            <Link
              key={value}
              href={href({ status: value })}
              aria-current={status === value ? "page" : undefined}
              className="rounded-panel border border-line px-3 py-2 text-sm aria-[current=page]:border-transparent aria-[current=page]:bg-soft aria-[current=page]:text-accent"
            >
              {value === "active" ? "Active" : "Archived"}
            </Link>
          ))}
        </nav>
      </div>

      <section
        aria-label="Items"
        className="overflow-hidden rounded-panel border border-line bg-panel"
      >
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-sub">
            {search
              ? `No items match “${search}”.`
              : status === "archived"
                ? "No archived items."
                : "No items yet. Save one from an invoice or add it here."}
          </div>
        ) : (
          <ul>
            {items.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.75 border-b border-line p-4.75 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
              >
                <div className="min-w-0">
                  <p className="font-medium wrap-anywhere">{item.description}</p>
                  <p className="text-xs text-sub">
                    Used {item.useCount} {item.useCount === 1 ? "time" : "times"}
                  </p>
                </div>
                <p className="hidden text-sm text-sub tabular-nums sm:block">
                  {formatAmount(item.unitPrice)}
                </p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditing({ mode: "edit", item })}
                  >
                    <Pencil aria-hidden className="size-4" />
                    <span className="sr-only sm:not-sr-only">Edit</span>
                    <span className="sr-only"> {item.description}</span>
                  </Button>
                  {status === "active" && (
                    <Button type="button" variant="ghost" onClick={() => setArchiving(item)}>
                      <Archive aria-hidden className="size-4" />
                      <span className="sr-only sm:not-sr-only">Archive</span>
                      <span className="sr-only"> {item.description}</span>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === "edit" ? "Edit item" : "Add item"}
      >
        {editing && (
          <SavedItemForm
            key={editing.mode === "edit" ? editing.item.id : "new"}
            businessId={businessId}
            item={editing.mode === "edit" ? editing.item : undefined}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={archiving !== null}
        onClose={() => setArchiving(null)}
        title="Archive this item?"
        description="It leaves the line item list. Invoices and quotes keep their copy."
      >
        <FormMessage>{archiveError}</FormMessage>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={() => setArchiving(null)}>
            Keep
          </Button>
          <Button type="button" pending={pending} onClick={confirmArchive}>
            Archive item
          </Button>
        </div>
      </Dialog>
    </>
  );
}
