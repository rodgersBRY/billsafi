"use client";

import type { WhatsNewEntry } from "@billsafi/contracts";
import { Megaphone, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { WhatsNewEntryCard } from "./whats-new-entry";
import { closeWhatsNew, useWhatsNew } from "./whats-new-store";

const monthFormat = new Intl.DateTimeFormat("en-KE", {
  month: "long",
  year: "numeric",
  timeZone: "Africa/Nairobi",
});

/** Entries arrive newest first, so groups come out newest first too. */
function byMonth(entries: WhatsNewEntry[]) {
  const groups: { month: string; items: WhatsNewEntry[] }[] = [];
  for (const entry of entries) {
    const month = monthFormat.format(new Date(entry.publishedAt));
    const last = groups.at(-1);
    if (last?.month === month) last.items.push(entry);
    else groups.push({ month, items: [entry] });
  }
  return groups;
}

/**
 * Slide-over list of product updates. Rendered in the main area, not the sidebar,
 * because the sidebar is hidden on small screens and a hidden dialog never shows.
 */
export function WhatsNewPanel({ businessId, isPro }: { businessId: string; isPro: boolean }) {
  const { feed, open } = useWhatsNew();
  const ref = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Start on the list, so the close button doesn't open with a focus ring.
      listRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Next.js keeps visited pages alive; never come back to an open dialog.
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);

  const entries = feed?.entries ?? [];
  const fresh = entries.filter((entry) => entry.unread).length;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        if (!ref.current?.open) closeWhatsNew();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) closeWhatsNew();
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-md bg-background p-0 text-ink shadow-2xl transition-[translate,opacity,display,overlay] transition-discrete duration-500 ease-out backdrop:bg-black/40 starting:open:translate-y-full starting:open:opacity-0 motion-reduce:transition-none md:inset-y-3 md:right-3 md:h-auto md:max-h-none md:rounded-xl md:border md:border-line"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-panel px-4 py-3 md:rounded-t-xl">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-md bg-teal text-white"
          >
            <Megaphone className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold">
              What&apos;s new
            </h2>
            <p className="text-xs text-sub">
              {fresh > 0 ? `${fresh} new since your last look` : "Latest updates to BillSafi"}
            </p>
          </div>
          <button
            type="button"
            onClick={closeWhatsNew}
            className="rounded-lg p-2 text-sub hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X aria-hidden className="size-5" />
            <span className="sr-only">Close</span>
          </button>
        </header>
        {entries.length === 0 ? (
          <div className="grid flex-1 place-content-center gap-2 px-6 text-center">
            {feed === null ? (
              <p className="text-sm text-sub">Loading…</p>
            ) : (
              <>
                <Megaphone aria-hidden className="mx-auto size-8 text-sub" />
                <p className="text-sm font-medium">Nothing new yet.</p>
                <p className="text-sm text-sub">New features show up here.</p>
              </>
            )}
          </div>
        ) : (
          <div
            ref={listRef}
            tabIndex={-1}
            className="flex-1 overflow-y-auto px-3 pt-1 pb-4 outline-none"
          >
            {byMonth(entries).map(({ month, items }) => (
              <section key={month} aria-label={month} className="mt-3">
                <h3 className="px-1 pb-1.5 text-xs font-semibold tracking-wide text-sub uppercase">
                  {month}
                </h3>
                <ol className="grid gap-2">
                  {items.map((entry) => (
                    <li key={entry.id}>
                      <WhatsNewEntryCard
                        {...entry}
                        businessId={businessId}
                        isPro={isPro}
                        onNavigate={closeWhatsNew}
                      />
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
