"use client";

import { CircleCheck, Check, LoaderCircle, RotateCcw, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = ["Request sent", "Enter your M-Pesa PIN", "Confirming payment"] as const;
/** The PIN step stays active until the backend reports a result; M-Pesa does not say when it was entered. */
const ACTIVE_STEP = 1;

interface PaymentWaitingProps {
  amount: string;
  phone: string;
  note: string;
  waitedTooLong: boolean;
}

/** Animated waiting state while the customer approves an STK Push prompt. */
export function PaymentWaiting({ amount, phone, note, waitedTooLong }: PaymentWaitingProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative flex size-16 items-center justify-center">
        {!waitedTooLong && (
          <>
            <span
              aria-hidden
              className="absolute inset-0 animate-ping rounded-full bg-soft motion-reduce:hidden"
            />
            <span
              aria-hidden
              className="absolute inset-2 animate-ping rounded-full bg-soft [animation-delay:400ms] motion-reduce:hidden"
            />
          </>
        )}
        <span className="relative flex size-12 items-center justify-center rounded-full bg-soft">
          <Smartphone aria-hidden className="size-6 text-accent" />
        </span>
      </div>

      <h2 className="mt-3 text-base font-semibold">Waiting for payment confirmation</h2>
      <p className="mt-1 text-sm text-sub">
        Approve {amount} on {phone}. {note}
      </p>

      <ol className="mt-4 w-full max-w-xs space-y-2 text-left text-sm">
        {STEPS.map((label, index) => {
          const done = index < ACTIVE_STEP;
          const active = index === ACTIVE_STEP;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2.5 ${active ? "font-medium" : done ? "" : "text-sub"}`}
            >
              {done ? (
                <CircleCheck aria-hidden className="size-4 shrink-0 text-accent" />
              ) : active ? (
                <LoaderCircle
                  aria-hidden
                  className="size-4 shrink-0 animate-spin text-accent motion-reduce:animate-none"
                />
              ) : (
                <span aria-hidden className="size-4 shrink-0 rounded-full border border-line" />
              )}
              {label}
            </li>
          );
        })}
      </ol>

      {!waitedTooLong && (
        <div
          aria-hidden
          className="relative mt-4 h-1 w-full max-w-xs overflow-hidden rounded-full bg-soft"
        >
          <span className="absolute inset-y-0 w-1/3 animate-indeterminate rounded-full bg-accent motion-reduce:hidden" />
        </div>
      )}

      <p className="mt-3 text-xs text-sub">
        {waitedTooLong
          ? "This is taking longer than usual. We'll keep checking, so you can come back later."
          : "Your payment can still be confirmed if you close this page."}
      </p>
    </div>
  );
}

interface PaymentSucceededProps {
  title: string;
  rows: { label: string; value: string; mono?: boolean }[];
  onDone: () => void;
}

/** Confirmed payment: a check that pops in once, then a short receipt. */
export function PaymentSucceeded({ title, rows, onDone }: PaymentSucceededProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative flex size-16 items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-0 animate-burst rounded-full bg-accent/25 motion-reduce:hidden"
        />
        <span className="relative flex size-12 animate-pop items-center justify-center rounded-full bg-accent text-white motion-reduce:animate-none">
          <Check aria-hidden strokeWidth={3} className="size-6" />
        </span>
      </div>

      <h2 className="mt-3 text-base font-semibold">Payment confirmed</h2>
      <p className="mt-1 text-sm text-sub">{title}</p>

      <dl className="mt-4 w-full max-w-xs divide-y divide-line rounded-panel border border-line text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 px-3.5 py-2.5">
            <dt className="text-sub">{row.label}</dt>
            <dd className={`font-medium ${row.mono ? "font-mono text-xs leading-5" : ""}`}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <Button type="button" className="mt-5" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

interface PaymentFailedProps {
  reason: string | null;
  note: string;
  onRetry: () => void;
  onClose: () => void;
}

/** Payment that M-Pesa rejected or the customer cancelled. */
export function PaymentFailed({ reason, note, onRetry, onClose }: PaymentFailedProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex size-12 animate-shake items-center justify-center rounded-full bg-red-50 text-red-700 motion-reduce:animate-none dark:bg-red-950 dark:text-red-300">
        <X aria-hidden strokeWidth={3} className="size-6" />
      </span>

      <h2 className="mt-3 text-base font-semibold">Payment was not completed</h2>
      {reason && (
        <p className="mt-2 max-w-xs rounded-panel bg-red-50 px-3.5 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {reason}
        </p>
      )}
      <p className="mt-2 text-sm text-sub">{note}</p>

      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button type="button" onClick={onRetry}>
          <RotateCcw aria-hidden className="size-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
