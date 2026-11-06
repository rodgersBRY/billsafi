import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { NewQuoteEditor } from "@/components/quotes/quote-editor";
import { loadEditorData } from "../../invoices/editor-data";

export const metadata: Metadata = { title: "New quote · BillSafi" };

async function NewQuote({ params }: { params: Promise<{ businessId: string }> }) {
  const data = await loadEditorData((await params).businessId);
  return (
    <NewQuoteEditor
      businessId={data.businessId}
      business={data.business}
      today={data.today}
      clients={data.clients}
    />
  );
}

export default function NewQuotePage({ params }: PageProps<"/[businessId]/quotes/new">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <NewQuote params={params} />
    </Suspense>
  );
}
