import type { PublicInvoice } from "@billsafi/contracts";
import { Download, FileX } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { getPublicInvoice } from "@/lib/server-api/public-invoices";

export const metadata: Metadata = {
  title: "Invoice",
  // Invoice links are private to whoever received them.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function Unavailable() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-panel border border-line bg-panel p-8 text-center">
      <FileX aria-hidden className="mx-auto size-8 text-sub" />
      <h1 className="mt-4 text-xl font-semibold">This invoice isn&apos;t available</h1>
      <p className="mt-2 text-sm text-sub">
        Invoice links work for 30 days. This one may have expired, been replaced with a new link, or
        been withdrawn by the sender. Ask them to send you a new link.
      </p>
    </div>
  );
}

function PublicInvoiceView({ token, invoice }: { token: string; invoice: PublicInvoice }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex justify-end">
        <a
          href={`/api/v1/public/invoices/${encodeURIComponent(token)}/pdf`}
          download
          className="inline-flex items-center gap-2 rounded-panel border border-teal bg-teal px-3.75 py-2.75 text-sm font-medium text-white hover:bg-teal/90"
        >
          <Download aria-hidden className="size-4" />
          Download PDF
        </a>
      </div>
      <InvoicePreview
        business={{ ...invoice.business, logoKey: null }}
        logoSrc={
          invoice.hasLogo ? `/api/v1/public/invoices/${encodeURIComponent(token)}/logo` : null
        }
        showBranding={invoice.showBranding}
        client={invoice.client}
        invoiceNumber={invoice.invoiceNumber}
        status={invoice.status}
        overdue={invoice.overdue}
        issueDate={invoice.issueDate}
        dueDate={invoice.dueDate}
        items={invoice.items}
        totals={{
          lineTotals: invoice.items.map((item) => item.lineTotal),
          subtotal: invoice.subtotal,
          discountAmount: invoice.discountAmount,
          taxAmount: invoice.taxAmount,
          total: invoice.total,
        }}
        discountLabel={
          invoice.discount
            ? invoice.discount.type === "percentage"
              ? `Discount (${Number(invoice.discount.value)}%)`
              : "Discount"
            : null
        }
        taxRate={invoice.taxRate ? String(Number(invoice.taxRate)) : null}
        paymentInstructions={invoice.paymentInstructions ?? ""}
        notes={invoice.notes ?? ""}
        paymentsReceived={invoice.paymentsReceived}
        balanceDue={invoice.balanceDue}
      />
      <p className="mt-4 text-center text-sm text-sub">
        Questions about this invoice? Contact{" "}
        <a href={`mailto:${invoice.business.contactEmail}`} className="text-accent hover:underline">
          {invoice.business.contactEmail}
        </a>
        .
      </p>
    </div>
  );
}

async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invoice = await getPublicInvoice(token);
  return invoice ? <PublicInvoiceView token={token} invoice={invoice} /> : <Unavailable />;
}

export default function Page({ params }: PageProps<"/i/[token]">) {
  return (
    <main className="flex-1 p-4 sm:p-8">
      <Suspense
        fallback={
          <div className="grid place-items-center py-16">
            <BrandLoader />
          </div>
        }
      >
        <PublicInvoicePage params={params} />
      </Suspense>
    </main>
  );
}
