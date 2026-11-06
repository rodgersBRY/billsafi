import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { QuoteEditor } from "@/components/quotes/quote-editor";
import { getQuote } from "@/lib/server-api/quotes";
import { loadEditorData } from "../../../invoices/editor-data";

export const metadata: Metadata = { title: "Edit quote · BillSafi" };

/** Accepted, converted and withdrawn quotes are closed; only the details page applies. */
async function EditQuote({ params }: { params: Promise<{ businessId: string; quoteId: string }> }) {
  const { businessId, quoteId } = await params;
  const quote = await getQuote(businessId, quoteId);
  if (["accepted", "converted", "withdrawn"].includes(quote.status)) {
    redirect(`/${businessId}/quotes/${quoteId}`);
  }
  const data = await loadEditorData(businessId);
  return (
    <QuoteEditor
      key={`${quote.id}:${quote.updatedAt}`}
      businessId={data.businessId}
      business={data.business}
      today={data.today}
      clients={data.clients}
      quote={quote}
    />
  );
}

export default function EditQuotePage({
  params,
}: PageProps<"/[businessId]/quotes/[quoteId]/edit">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <EditQuote params={params} />
    </Suspense>
  );
}
