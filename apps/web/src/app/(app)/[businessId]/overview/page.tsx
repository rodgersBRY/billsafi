import { FilePlus, UserPlus, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { getBusiness } from "@/lib/api.server";

export const metadata: Metadata = { title: "Overview · TallyNest" };

const QUICK_ACTIONS = [
  { label: "Create invoice", icon: FilePlus },
  { label: "Add client", icon: UserPlus },
  { label: "Record payment", icon: Wallet },
];

async function Overview({ params }: { params: Promise<{ businessId: string }> }) {
  const business = await getBusiness((await params).businessId);
  return (
    <>
      <div className="mb-6.25 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1>
          <p className="mt-1.25 text-sm text-sub">{business.displayName}</p>
        </div>
      </div>
      <section className="rounded-panel border border-line bg-panel p-6">
        <h2 className="text-base font-semibold">No invoices yet</h2>
        <p className="mt-1.5 max-w-prose text-sm text-sub">
          Your outstanding balance, overdue amounts and payments received this month will show here
          once you start invoicing.
        </p>
        <ul className="mt-5 flex flex-wrap gap-2.5">
          {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
            <li key={label}>
              <span
                aria-disabled="true"
                title="Coming in the next release"
                className="inline-flex cursor-default items-center gap-2 rounded-panel border border-line px-3.25 py-2.25 text-sm text-sub opacity-70"
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function OverviewPage({ params }: PageProps<"/[businessId]/overview">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <Overview params={params} />
    </Suspense>
  );
}
