"use client";

import { type GettingStarted, PRODUCT_TOUR_VERSIONS } from "@billsafi/contracts";
import { ChevronRight, CircleCheck, Circle, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { apiSend } from "@/lib/api.client";

const ITEMS: { key: keyof GettingStarted; label: string; path: string }[] = [
  { key: "addClient", label: "Add a client", path: "clients" },
  { key: "createInvoice", label: "Create an invoice", path: "invoices/new" },
  { key: "shareInvoice", label: "Share an invoice link", path: "invoices" },
  { key: "paymentInstructions", label: "Add payment instructions", path: "settings?tab=payment" },
  { key: "recordPayment", label: "Record a payment", path: "invoices" },
];

/** Account-wide first steps on the Overview page (D057). */
export function GettingStartedCard({
  businessId,
  progress,
}: {
  businessId: string;
  progress: GettingStarted;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const done = ITEMS.filter((item) => progress[item.key]).length;

  function dismiss() {
    setHidden(true);
    apiSend("PUT", "/me/tours/getting-started-checklist", {
      version: PRODUCT_TOUR_VERSIONS["getting-started-checklist"],
      status: "dismissed",
    }).catch(() => {
      // Not saved: the card returns next visit and can be hidden again.
    });
  }

  return (
    <section
      aria-labelledby="getting-started"
      data-tour="getting-started"
      className="mb-6.25 rounded-panel border border-line bg-panel p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="getting-started" className="text-base font-semibold">
            Get set up
          </h2>
          <p className="mt-1 text-sm text-sub">
            {done} of {ITEMS.length} done
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide setup checklist"
          className="rounded-lg p-1.5 text-sub hover:bg-soft hover:text-ink"
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
        className="my-4 h-1.25 rounded-lg bg-line"
      >
        <div
          className="h-full rounded-lg bg-teal"
          style={{ width: `${(done / ITEMS.length) * 100}%` }}
        />
      </div>
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ key, label, path }) =>
          progress[key] ? (
            <li key={key} className="flex items-center gap-2.5 rounded-lg p-2.5 text-sm text-sub">
              <CircleCheck aria-hidden className="size-4.5 text-accent" />
              <span className="line-through">{label}</span>
              <span className="sr-only">(done)</span>
            </li>
          ) : (
            <li key={key}>
              <Link
                href={`/${businessId}/${path}`}
                className="group flex items-center gap-2.5 rounded-lg p-2.5 text-sm hover:bg-soft"
              >
                <Circle aria-hidden className="size-4.5 text-sub" />
                <span className="flex-1">{label}</span>
                <ChevronRight
                  aria-hidden
                  className="size-4 text-sub opacity-0 transition-opacity group-hover:opacity-100"
                />
              </Link>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
