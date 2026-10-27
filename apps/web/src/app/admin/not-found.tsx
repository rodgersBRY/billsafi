import { SearchX } from "lucide-react";
import Link from "next/link";

/** A missing tenant or user, shown inside the admin shell. */
export default function AdminNotFound() {
  return (
    <div className="mx-auto grid max-w-md place-items-center gap-2 py-16 text-center">
      <SearchX aria-hidden className="size-8 text-sub" />
      <h1 className="text-xl font-semibold tracking-tight">We couldn&apos;t find that record</h1>
      <p className="text-sm text-sub">It may have been deleted, or the link is wrong.</p>
      <Link
        href="/admin/tenants"
        className="mt-3 inline-flex min-h-11 items-center rounded-panel border border-line bg-panel px-3.75 text-sm font-medium hover:bg-soft"
      >
        Go to tenants
      </Link>
    </div>
  );
}
