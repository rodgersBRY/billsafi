import { FilePlus, UserPlus, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { shouldShowTour } from "@billsafi/contracts";
import { BrandLoader } from "@/components/brand/brand-loader";
import { ProductTour } from "@/components/tour/product-tour";
import { StatusPill } from "@/components/ui/status-pill";
import { getBusiness } from "@/lib/server-api/businesses";
import { getDashboard } from "@/lib/server-api/invoices";
import { getGettingStarted, getProductTours } from "@/lib/server-api/product-tours";
import { formatAmount, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Overview · BillSafi" };

const QUICK_ACTIONS = [
  { label: "Create invoice", icon: FilePlus, path: "invoices/new" },
  { label: "Add client", icon: UserPlus, path: "clients" },
  { label: "Record payment", icon: Wallet, path: "invoices" },
] as const;

async function Overview({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ tour?: string }>;
}) {
  const [{ businessId }, { tour }] = await Promise.all([params, searchParams]);
  const [business, dashboard, tours, progress] = await Promise.all([
    getBusiness(businessId),
    getDashboard(businessId),
    getProductTours(),
    getGettingStarted(),
  ]);
  const base = `/${businessId}`;
  const metrics = [
    { label: "Outstanding", value: dashboard.outstanding, hint: "Ready and partly paid invoices" },
    { label: "Overdue", value: dashboard.overdue, hint: "Past the due date" },
    { label: "Received this month", value: dashboard.receivedThisMonth, hint: "By payment date" },
  ];

  return (
    <>
      <ProductTour
        autoStart={shouldShowTour(tours, "first-run")}
        replay={tour === "1"}
        paymentInstructionsMissing={!progress.paymentInstructions}
      />
      <div className="mb-6.25 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1>
          <p className="mt-1.25 text-sm text-sub">{business.displayName}</p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ label, icon: Icon, path }, index) => (
            <li key={label} data-tour={index === 0 ? "create-invoice" : undefined}>
              <Link
                href={`${base}/${path}`}
                className={`inline-flex items-center gap-2 rounded-panel border px-3.75 py-2.75 text-sm font-medium ${
                  index === 0
                    ? "border-teal bg-teal text-white hover:bg-teal/90"
                    : "border-line bg-panel hover:bg-soft"
                }`}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <dl data-tour="totals" className="mb-6.25 grid gap-3.25 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-panel border border-line bg-panel p-5">
            <dt className="text-sm text-sub">{metric.label}</dt>
            <dd className="mt-2.5 mb-1.25 text-2xl font-medium tracking-tight tabular-nums">
              <span className="mr-1.25 text-xs font-normal text-sub">{dashboard.currency}</span>
              {formatAmount(metric.value)}
            </dd>
            <dd className="text-xs text-sub">{metric.hint}</dd>
          </div>
        ))}
      </dl>

      <section
        aria-labelledby="recent"
        className="overflow-hidden rounded-panel border border-line bg-panel"
      >
        <div className="flex items-center justify-between gap-2.5 px-5 py-4.75">
          <h2 id="recent" className="text-base font-semibold">
            Recent invoices
          </h2>
          <Link href={`${base}/invoices`} className="text-sm text-accent hover:underline">
            View all
          </Link>
        </div>
        {dashboard.recentInvoices.length === 0 ? (
          <p className="border-t border-line p-5 text-sm text-sub">
            Invoices you mark Ready will show here.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-xs text-sub">
              <tr>
                <th scope="col" className="px-5 py-3 font-normal">
                  Invoice
                </th>
                <th scope="col" className="hidden px-5 py-3 font-normal sm:table-cell">
                  Due
                </th>
                <th scope="col" className="px-5 py-3 text-right font-normal">
                  Balance · KES
                </th>
                <th scope="col" className="px-5 py-3 font-normal">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {dashboard.recentInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-line">
                  <td className="px-5 py-3.5">
                    <Link
                      href={`${base}/invoices/${invoice.id}`}
                      className="font-medium hover:text-accent hover:underline"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                    <p className="text-xs text-sub">{invoice.clientName}</p>
                  </td>
                  <td className="hidden px-5 py-3.5 text-sub sm:table-cell">
                    {formatDate(invoice.dueDate)}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums">
                    {formatAmount(invoice.balanceDue)}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill status={invoice.status} overdue={invoice.overdue} />
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

export default function OverviewPage({
  params,
  searchParams,
}: PageProps<"/[businessId]/overview">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <Overview params={params} searchParams={searchParams} />
    </Suspense>
  );
}
