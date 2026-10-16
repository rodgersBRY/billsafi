"use client";

import type { Business } from "@tallynest/contracts";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId } from "react";

export function BusinessSwitcher({
  businesses,
  currentId,
}: {
  businesses: Pick<Business, "id" | "displayName">[];
  currentId: string;
}) {
  const router = useRouter();
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="text-xs text-sub">
        Business
      </label>
      <select
        id={id}
        value={currentId}
        onChange={(event) => router.push(`/${event.target.value}/overview`)}
        className="mt-1.5 w-full rounded-lg border border-line bg-background px-1.5 py-2.5 text-sm text-ink"
      >
        {businesses.map((business) => (
          <option key={business.id} value={business.id}>
            {business.displayName}
          </option>
        ))}
      </select>
      <Link
        href="/onboarding"
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-teal hover:underline"
      >
        <Plus aria-hidden className="size-3.5" />
        Add a business
      </Link>
    </div>
  );
}
