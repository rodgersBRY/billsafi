import { recurringFrequencyLabels } from "@billsafi/contracts";
import { Crown, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { RecurringStatusPill } from "@/components/recurring/recurring-status";
import { formatAmount, formatDate } from "@/lib/format";
import { getUsage } from "@/lib/server-api/billing";
import { listRecurring } from "@/lib/server-api/recurring";

export const metadata: Metadata = { title: "Recurring · BillSafi" };

async function Recurring({ params }: PageProps<"/[businessId]/recurring">) {
  const { businessId } = await params;
  const [schedules, usage] = await Promise.all([listRecurring(businessId), getUsage()]);
  const base = `/${businessId}/recurring`;
  const isPro = usage.plan === "pro";

  return (
    <>
      <div className="mb-5.75 flex flex-wrap items-center justify-between gap-3.75">
        <div>
          <p className="text-xs text-sub">Recurring / Selected business</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Recurring</h1>
          <p className="mt-1.25 text-sm text-sub">Invoices that make themselves on a schedule.</p>
        </div>
        {isPro ? (
          <Link
            href={`${base}/new`}
            className="inline-flex items-center gap-2 rounded-panel border border-teal bg-teal px-3.75 py-2.75 text-sm font-medium text-white hover:bg-teal/90"
          >
            <Plus aria-hidden className="size-4" />
            New recurring invoice
          </Link>
        ) : (
          <p className="rounded-panel border border-line bg-soft px-3.75 py-2.75 text-sm text-accent">
            <Crown aria-hidden className="mr-1.5 inline-block size-4 align-text-bottom text-gold" />
            Recurring invoices are a Pro feature.{" "}
            <Link href="/billing" className="font-medium underline">
              Upgrade to Pro
            </Link>
          </p>
        )}
      </div>

      <section
        aria-label="Recurring invoices"
        className="overflow-hidden rounded-panel border border-line bg-panel"
      >
        {schedules.length === 0 ? (
          <div className="p-8 text-center text-sm text-sub">
            No recurring invoices yet. Set one up for work you bill every period.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-xs text-sub">
              <tr>
                <th scope="col" className="px-4 py-3 font-normal">
                  Client
                </th>
                <th scope="col" className="hidden px-4 py-3 font-normal sm:table-cell">
                  Repeats
                </th>
                <th scope="col" className="hidden px-4 py-3 font-normal sm:table-cell">
                  Next
                </th>
                <th scope="col" className="px-4 py-3 text-right font-normal">
                  Amount · KES
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => (
                <tr key={schedule.id} className="border-t border-line hover:bg-background/60">
                  <td className="px-4 py-4">
                    <Link
                      href={`${base}/${schedule.id}`}
                      className="font-medium hover:text-accent hover:underline"
                    >
                      {schedule.clientName}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-4 text-sub sm:table-cell">
                    {recurringFrequencyLabels[schedule.frequency]}
                  </td>
                  <td className="hidden px-4 py-4 text-sub sm:table-cell">
                    {schedule.nextRunDate ? formatDate(schedule.nextRunDate) : "Ended"}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">
                    {formatAmount(schedule.total)}
                  </td>
                  <td className="px-4 py-4">
                    <RecurringStatusPill
                      status={schedule.status}
                      pausedReason={schedule.pausedReason}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

export default function RecurringPage(props: PageProps<"/[businessId]/recurring">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <Recurring {...props} />
    </Suspense>
  );
}
