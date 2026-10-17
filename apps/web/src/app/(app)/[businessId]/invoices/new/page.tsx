import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { loadEditorData } from "../editor-data";

export const metadata: Metadata = { title: "New invoice · Billsafi" };

async function NewInvoice({ params }: { params: Promise<{ businessId: string }> }) {
  const data = await loadEditorData((await params).businessId);
  return <InvoiceEditor {...data} />;
}

export default function NewInvoicePage({ params }: PageProps<"/[businessId]/invoices/new">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <NewInvoice params={params} />
    </Suspense>
  );
}
