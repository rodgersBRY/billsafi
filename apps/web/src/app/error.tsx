"use client";

import { ErrorState } from "@/components/states/error-state";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <ErrorState error={error} retry={retry} />
    </main>
  );
}
