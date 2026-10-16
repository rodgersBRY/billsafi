import { type InvoiceStatus, invoiceStatusLabels, invoiceStatuses } from "@tallynest/contracts";
import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { StatusPill } from "@/components/ui/status-pill";
import { listInvoices } from "@/lib/api.server";
import { formatAmount, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Invoices · TallyNest" };

function isStatus(value: unknown): value is InvoiceStatus {
  return invoiceStatuses.includes(value as InvoiceStatus);
}

async function Invoices({ params, searchParams }: PageProps<"/[businessId]/invoices">) {
  const [{ businessId }, query] = await Promise.all([params, searchParams]);
  const status = isStatus(query.status) ? query.status : undefined;
  const search = typeof query.q === "string" ? query.q.trim() : "";
  const invoices = await listInvoices(businessId, { status, search: search || undefined });
  const base = `/${businessId}/invoices`;
  const tabHref = (value?: InvoiceStatus) => {
    const params = new URLSearchParams();
    if (value) params.set("status", value);
    if (search) params.set("q", search);
    const queryString = params.toString();
    return queryString ? `${base}?${queryString}` : base;
  };

  return (
    <>
      <div className="mb-5.75 flex flex-wrap items-center justify-between gap-3.75">
        <div>
          <p className="text-xs text-sub">Invoices / Selected business</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Every invoice, in view.
          </h1>
          <p className="mt-1.25 text-sm text-sub">Find the details. Keep payments moving.</p>
        </div>
        <Link
          href={`${base}/new`}
          className="inline-flex items-center gap-2 rounded-panel border border-teal bg-teal px-3.75 py-2.75 text-sm font-medium text-white hover:bg-teal/90"
        >
          <Plus aria-hidden className="size-4" />
          Create invoice
        </Link>
      </div>

      <div className="mb-4.25 flex flex-wrap gap-2.5">
        <form role="search" method="get" action={base} className="relative min-w-40 flex-1">
          {status && <input type="hidden" name="status" value={status} />}
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-sub"
          />
          <input
            name="q"
            type="search"
            defaultValue={search}
            aria-label="Search invoices"
            placeholder="Search number or client"
            className="w-full rounded-panel border border-line bg-panel py-2.5 pr-2.5 pl-8.5 text-sm"
          />
        </form>
      </div>
      <nav aria-label="Invoice status" className="mb-4 flex flex-wrap gap-1.5">
        {[undefined, ...invoiceStatuses].map((value) => (
          <Link
            key={value ?? "all"}
            href={tabHref(value)}
            aria-current={status === value ? "page" : undefined}
            className="rounded-panel border border-line px-3 py-2 text-sm aria-[current=page]:border-transparent aria-[current=page]:bg-soft aria-[current=page]:text-teal"
          >
            {value ? invoiceStatusLabels[value] : "All invoices"}
          </Link>
        ))}
      </nav>

      <section
        aria-label="Invoices"
        className="overflow-hidden rounded-panel border border-line bg-panel"
      >
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-sm text-sub">
            {search || status
              ? "No invoices match these filters."
              : "No invoices yet. Create your first invoice to get started."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-xs text-sub">
              <tr>
                <th scope="col" className="px-4 py-3 font-normal">
                  Invoice
                </th>
                <th scope="col" className="hidden px-4 py-3 font-normal sm:table-cell">
                  Due
                </th>
                <th scope="col" className="px-4 py-3 text-right font-normal">
                  Balance · KES
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-line hover:bg-background/60">
                  <td className="px-4 py-4">
                    <Link
                      href={`${base}/${invoice.id}`}
                      className="font-medium hover:text-teal hover:underline"
                    >
                      {invoice.invoiceNumber ?? "Draft"}
                    </Link>
                    <p className="text-xs text-sub">{invoice.clientName}</p>
                  </td>
                  <td className="hidden px-4 py-4 text-sub sm:table-cell">
                    {formatDate(invoice.dueDate)}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">
                    {formatAmount(invoice.balanceDue)}
                  </td>
                  <td className="px-4 py-4">
                    <StatusPill status={invoice.status} />
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

export default function InvoicesPage(props: PageProps<"/[businessId]/invoices">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <Invoices {...props} />
    </Suspense>
  );
}
