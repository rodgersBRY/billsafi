"use client";

import * as Sentry from "@sentry/nextjs";
import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Shared body for error boundaries: plain message, retry, and a way home. */
export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto grid max-w-md place-items-center py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-sub">
        This page didn&apos;t load. Your records are safe. Try again, or go back to the start.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        <Button type="button" onClick={() => retry()}>
          <RotateCw aria-hidden className="size-4" />
          Try again
        </Button>
        <Link
          href="/"
          className="inline-flex items-center rounded-panel border border-line bg-panel px-3.75 py-2.75 text-sm font-medium hover:bg-soft"
        >
          Go to start
        </Link>
      </div>
    </div>
  );
}
