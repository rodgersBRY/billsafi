"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

/** Reads every indicator again. The health route is never cached. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      className="min-h-11 md:min-h-0"
      pending={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {!pending && <RefreshCw aria-hidden className="size-4" />}
      Refresh
    </Button>
  );
}
