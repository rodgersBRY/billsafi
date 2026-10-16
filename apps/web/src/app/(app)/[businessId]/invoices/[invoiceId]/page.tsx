import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { getInvoice } from "@/lib/api.server";
import { loadEditorData } from "../editor-data";

export const metadata: Metadata = { title: "Invoice · TallyNest" };

async function ExistingInvoice({
  params,
}: {
  params: Promise<{ businessId: string; invoiceId: string }>;
}) {
  const { businessId, invoiceId } = await params;
  const [data, invoice] = await Promise.all([
    loadEditorData(businessId),
    getInvoice(businessId, invoiceId),
  ]);
  // Remount when the server data changes (for example after Mark as Ready).
  return <InvoiceEditor key={`${invoice.id}:${invoice.updatedAt}`} {...data} invoice={invoice} />;
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
      <ExistingInvoice params={params} />
    </Suspense>
  );
}
