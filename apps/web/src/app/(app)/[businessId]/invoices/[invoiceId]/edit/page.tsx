import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { getInvoice } from "@/lib/server-api/invoices";
import { loadEditorData } from "../../editor-data";

export const metadata: Metadata = { title: "Edit invoice · Billsafi" };

/** Ready invoices stay editable until payment activity locks them (D009, D043). */
async function EditInvoice({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string; invoiceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { businessId, invoiceId } = await params;
  const query = await searchParams;
  // Strict equality, so repeated (array) params fall through to no banner.
  const fromGenerator =
    query.from === "generator" ? (query.existing === "1" ? "existing" : "new") : undefined;
  const invoice = await getInvoice(businessId, invoiceId);
  const details = `/${businessId}/invoices/${invoiceId}`;
  if (invoice.status !== "draft" && (invoice.status !== "ready" || invoice.financialsLocked)) {
    redirect(details);
  }
  const data = await loadEditorData(businessId);
  return (
    <InvoiceEditor
      key={`${invoice.id}:${invoice.updatedAt}`}
      {...data}
      invoice={invoice}
      fromGenerator={fromGenerator}
    />
  );
}

export default function EditInvoicePage({
  params,
  searchParams,
}: PageProps<"/[businessId]/invoices/[invoiceId]/edit">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <EditInvoice params={params} searchParams={searchParams} />
    </Suspense>
  );
}
