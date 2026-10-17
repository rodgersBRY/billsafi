import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { InvoiceDetails } from "@/components/invoices/invoice-details";
import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { getInvoice, getInvoiceLink, listPayments } from "@/lib/api.server";
import { todayInNairobi } from "@/lib/format";
import { loadEditorData } from "../editor-data";

export const metadata: Metadata = { title: "Invoice · TallyNest" };

type Params = Promise<{ businessId: string; invoiceId: string }>;

/** Drafts open in the editor; issued invoices open their details (D039). */
async function InvoiceScreen({ params }: { params: Params }) {
  const { businessId, invoiceId } = await params;
  const invoice = await getInvoice(businessId, invoiceId);
  if (invoice.status === "draft") {
    const data = await loadEditorData(businessId);
    return <InvoiceEditor key={`${invoice.id}:${invoice.updatedAt}`} {...data} invoice={invoice} />;
  }
  await connection();
  const [payments, link] = await Promise.all([
    listPayments(businessId, invoiceId),
    getInvoiceLink(businessId, invoiceId),
  ]);
  return (
    <InvoiceDetails
      businessId={businessId}
      invoice={invoice}
      payments={payments}
      link={link}
      today={todayInNairobi()}
    />
  );
}

export default function InvoicePage({ params }: PageProps<"/[businessId]/invoices/[invoiceId]">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <InvoiceScreen params={params} />
    </Suspense>
  );
}
