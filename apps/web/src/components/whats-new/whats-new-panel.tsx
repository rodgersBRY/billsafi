"use client";

import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { WhatsNewEntryCard } from "./whats-new-entry";
import { closeWhatsNew, useWhatsNew } from "./whats-new-store";

/**
 * Slide-over list of product updates. Rendered in the main area, not the sidebar,
 * because the sidebar is hidden on small screens and a hidden dialog never shows.
 */
export function WhatsNewPanel({ businessId, isPro }: { businessId: string; isPro: boolean }) {
  const { feed, open } = useWhatsNew();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Next.js keeps visited pages alive; never come back to an open dialog.
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);

  const entries = feed?.entries ?? [];

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
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-md border-l border-line bg-panel p-0 text-ink shadow-xl backdrop:bg-black/30"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold">
            What&apos;s new
          </h2>
          <button
            type="button"
            onClick={closeWhatsNew}
            className="rounded-lg p-1.5 text-sub hover:bg-soft hover:text-ink"
          >
            <X aria-hidden className="size-5" />
            <span className="sr-only">Close</span>
          </button>
        </header>
        {entries.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-sub">
            {feed === null ? "Loading…" : "Nothing new yet."}
          </p>
        ) : (
          <ol className="flex-1 divide-y divide-line overflow-y-auto">
            {entries.map((entry) => (
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
        )}
      </div>
    </dialog>
  );
}
