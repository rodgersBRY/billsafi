import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { QuoteDetails } from "@/components/quotes/quote-details";
import { QuoteEditor } from "@/components/quotes/quote-editor";
import { getQuote, getQuoteLink, getQuoteVersion } from "@/lib/server-api/quotes";
import { loadEditorData } from "../../invoices/editor-data";

export const metadata: Metadata = { title: "Quote · BillSafi" };

/** Drafts open in the editor; sent quotes open their details. */
async function QuoteScreen({ params, searchParams }: PageProps<"/[businessId]/quotes/[quoteId]">) {
  const [{ businessId, quoteId }, query] = await Promise.all([params, searchParams]);
  const quote = await getQuote(businessId, quoteId);
  if (quote.status === "draft") {
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
  await connection();
  const raw = Array.isArray(query.version) ? query.version[0] : query.version;
  const number = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  const [link, version] = await Promise.all([
    getQuoteLink(businessId, quoteId),
    number !== null && quote.version !== null && number >= 1 && number < quote.version
      ? getQuoteVersion(businessId, quoteId, number)
      : undefined,
  ]);
  return <QuoteDetails businessId={businessId} quote={quote} link={link} version={version} />;
}

export default function QuotePage(props: PageProps<"/[businessId]/quotes/[quoteId]">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <QuoteScreen {...props} />
    </Suspense>
  );
}
