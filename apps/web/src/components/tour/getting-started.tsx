"use client";

import { type GettingStarted, PRODUCT_TOUR_VERSIONS } from "@billsafi/contracts";
import { ChevronDown, ChevronRight, Circle, CircleCheck, ListChecks, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { apiSend } from "@/lib/api.client";
import { useHydrated } from "@/lib/use-hydrated";

const ITEMS: { key: keyof GettingStarted; label: string; path: string }[] = [
  { key: "addClient", label: "Add a client", path: "clients" },
  { key: "createInvoice", label: "Create an invoice", path: "invoices/new" },
  { key: "shareInvoice", label: "Share an invoice link", path: "invoices" },
  { key: "paymentInstructions", label: "Add payment instructions", path: "settings?tab=payment" },
  { key: "recordPayment", label: "Record a payment", path: "invoices" },
];

const COLLAPSED_KEY = "billsafi:setup-collapsed";

/** Overview only: remembered per browser; first visit opens on wide screens, stays small on phones. */
function initiallyOpen(): boolean {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    if (saved !== null) return saved !== "1";
  } catch {
    // Storage blocked: fall back to the screen size.
  }
  return window.matchMedia("(min-width: 48rem)").matches;
}

function rememberCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Storage blocked: the choice lasts until the next page load.
  }
}

/**
 * Account-wide first steps, floating at the bottom right of every app page (D057).
 * It opens fully only on the Overview; elsewhere it stays a small pill so it does
 * not cover the page's own buttons.
 */
export function GettingStartedPanel(props: { businessId: string; progress: GettingStarted }) {
  // Open state comes from browser storage, so render only once hydrated.
  const hydrated = useHydrated();
  return hydrated ? <Panel {...props} /> : null;
}

function Panel({ businessId, progress }: { businessId: string; progress: GettingStarted }) {
  const pathname = usePathname();
  const onOverview = pathname.endsWith("/overview");
  const [overviewOpen, setOverviewOpen] = useState(initiallyOpen);
  // Opened by hand on another page; navigating away shrinks it again.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const done = ITEMS.filter((item) => progress[item.key]).length;

  const open = onOverview ? overviewOpen : openedOn === pathname;

  function toggle(next: boolean) {
    if (onOverview) {
      setOverviewOpen(next);
      rememberCollapsed(!next);
    } else {
      setOpenedOn(next ? pathname : null);
    }
  }

  function dismiss() {
    setHidden(true);
    apiSend("PUT", "/me/tours/getting-started-checklist", {
      version: PRODUCT_TOUR_VERSIONS["getting-started-checklist"],
      status: "dismissed",
    }).catch(() => {
      // Not saved: the panel returns next visit and can be hidden again.
    });
  }

  const position = "fixed right-4 bottom-4 z-20 sm:right-6 sm:bottom-6";

  if (!open) {
    return (
      <button
        type="button"
        data-setup-checklist=""
        onClick={() => toggle(true)}
        aria-label={`Get set up, ${done} of ${ITEMS.length} done`}
        className={`${position} flex items-center gap-2.5 rounded-full border border-line bg-panel py-2.5 pr-4 pl-3 text-sm font-medium shadow-lg hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
      >
        <ListChecks aria-hidden className="size-4.5 text-accent" />
        Get set up
        <span className="rounded-full bg-soft px-2 py-0.5 text-xs text-accent tabular-nums">
          {done}/{ITEMS.length}
        </span>
      </button>
    );
  }

  return (
    <section
      data-setup-checklist=""
      aria-labelledby="getting-started"
      className={`${position} w-80 max-w-[calc(100vw-2rem)] rounded-panel border border-line bg-panel shadow-xl`}
    >
      <div className="flex items-start gap-3 px-4 pt-4">
        <ListChecks aria-hidden className="mt-0.5 size-4.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <h2 id="getting-started" className="text-sm font-semibold">
            Get set up
          </h2>
          <p className="mt-0.5 text-xs text-sub">
            {done} of {ITEMS.length} done
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggle(false)}
          aria-label="Minimise setup checklist"
          className="rounded-lg p-1.5 text-sub hover:bg-soft hover:text-ink"
        >
          <ChevronDown aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide setup checklist"
          className="-ml-1.5 rounded-lg p-1.5 text-sub hover:bg-soft hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={ITEMS.length}
        aria-valuenow={done}
        className="mx-4 mt-3 mb-2 h-1.25 rounded-lg bg-line"
      >
        <div
          className="h-full rounded-lg bg-teal transition-[width]"
          style={{ width: `${(done / ITEMS.length) * 100}%` }}
        />
      </div>
      <ul className="grid gap-0.5 px-2 pb-2">
        {ITEMS.map(({ key, label, path }) =>
          progress[key] ? (
            <li
              key={key}
              className="flex items-center gap-3 rounded-lg px-2 py-2.25 text-sm text-sub"
            >
              <CircleCheck aria-hidden className="size-4.5 shrink-0 text-accent" />
              <span className="line-through decoration-line">{label}</span>
              <span className="sr-only">(done)</span>
            </li>
          ) : (
            <li key={key}>
              <Link
                href={`/${businessId}/${path}`}
                className="group flex items-center gap-3 rounded-lg px-2 py-2.25 text-sm hover:bg-soft"
              >
                <Circle aria-hidden className="size-4.5 shrink-0 text-sub" />
                <span className="flex-1">{label}</span>
                <ChevronRight
                  aria-hidden
                  className="size-4 text-sub transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
