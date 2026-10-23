"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";

/** Last resort when the root layout itself fails; it replaces the whole document. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-background p-6 font-sans text-ink">
        <div role="alert" className="max-w-md text-center">
          <h1 className="text-xl font-semibold">BillSafi is having trouble</h1>
          <p className="mt-2 text-sm text-sub">Please try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-5 rounded-panel border border-teal bg-teal px-3.75 py-2.75 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
