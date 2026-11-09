import { FREE_PLAN } from "@billsafi/domain";
import { Crown } from "lucide-react";
import Link from "next/link";

/** Shown on /onboarding when a Free account already has its business (D085). */
export function BusinessLimitNotice() {
  return (
    <section className="col-span-full mx-auto mt-10 max-w-md rounded-panel border border-line bg-panel p-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Add another business</h1>
      <p className="mt-2 text-sm text-sub">
        <Crown aria-hidden className="mr-1.5 inline-block size-4 align-text-bottom text-gold" />
        The Free plan includes {FREE_PLAN.businessLimit} business. Upgrade to Pro to add more.
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <Link
          href="/billing"
          className="inline-flex items-center rounded-panel border border-teal bg-teal px-3.75 py-2.75 text-sm font-medium text-white hover:bg-teal/90"
        >
          Upgrade to Pro
        </Link>
        <Link
          href="/"
          className="inline-flex items-center rounded-panel border border-line px-3.75 py-2.75 text-sm text-ink hover:bg-soft"
        >
          Back
        </Link>
      </div>
    </section>
  );
}
