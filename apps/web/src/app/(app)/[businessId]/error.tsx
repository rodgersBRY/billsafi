"use client";

import { ErrorState } from "@/components/states/error-state";

/** Keeps the sidebar in place when one page of the business app fails. */
export default function BusinessError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} retry={retry} />;
}
