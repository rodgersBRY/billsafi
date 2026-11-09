"use client";

import type { Business } from "@billsafi/contracts";
import { Building2, Crown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { sidebarClasses } from "./sidebar-mode";
import { useSidebar } from "./sidebar-state";

const classes = sidebarClasses("group");

export function BusinessSwitcher({
  businesses,
  currentId,
  canAddBusiness,
}: {
  businesses: Pick<Business, "id" | "displayName">[];
  currentId: string;
  /** False for Free accounts at the business cap (D085). The link then goes to billing. */
  canAddBusiness: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const { expand } = useSidebar();
  const current = businesses.find((business) => business.id === currentId);

  return (
    <>
      {/* The select needs room, so the rail button opens the full sidebar. */}
      <button
        type="button"
        onClick={expand}
        aria-label={`Switch business, current: ${current?.displayName ?? ""}`}
        title={current?.displayName}
        className={`min-h-11 place-items-center rounded-lg border border-line text-sub hover:bg-soft hover:text-ink ${classes.railOnly}`}
      >
        <Building2 aria-hidden className="size-4.5" />
      </button>
      <div className={classes.expandedBlock}>
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
          href={canAddBusiness ? "/onboarding" : `/${currentId}/billing`}
          title={canAddBusiness ? undefined : "Pro feature"}
          className="mt-2 inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-accent hover:underline"
        >
          {canAddBusiness ? (
            <Plus aria-hidden className="size-3.5" />
          ) : (
            <Crown aria-hidden className="size-3.5 text-gold" />
          )}
          Add a business
        </Link>
      </div>
    </>
  );
}
