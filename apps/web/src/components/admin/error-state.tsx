"use client";

import * as Sentry from "@sentry/nextjs";
import { RotateCw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";

/** A failed admin request: a plain message and a retry that fetches the page again. */
export function AdminErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto grid max-w-md place-items-center gap-2 rounded-panel border border-line bg-panel px-6 py-12 text-center"
    >
      <TriangleAlert aria-hidden className="size-7 text-red-700 dark:text-red-300" />
      <h1 className="text-lg font-semibold">This page didn&apos;t load</h1>
      <p className="text-sm text-sub">
        The admin API didn&apos;t answer as expected. Nothing was changed. Try again in a moment.
      </p>
      <Button
        type="button"
        className="mt-3"
        pending={pending}
        onClick={() =>
          startTransition(() => {
            router.refresh();
            retry();
          })
        }
      >
        {!pending && <RotateCw aria-hidden className="size-4" />}
        Try again
      </Button>
    </div>
  );
}
