import type { PublicQuote } from "@billsafi/contracts";
import { CircleCheckBig, Download, FileX } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { QuoteResponseForm } from "@/components/quotes/quote-response-form";
import { quotePreviewProps } from "@/components/quotes/quote-preview-props";
import { QuoteStatusPill } from "@/components/ui/quote-status-pill";
import { formatDate } from "@/lib/format";
import { getPublicQuote } from "@/lib/server-api/public-quotes";

export const metadata: Metadata = {
  title: "Quote",
  // Quote links are private to whoever received them.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** A saved timestamp as a Nairobi calendar date. */
function nairobiDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(
    new Date(timestamp),
  );
}

function Unavailable() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-panel border border-line bg-panel p-8 text-center">
      <FileX aria-hidden className="mx-auto size-8 text-sub" />
      <h1 className="mt-4 text-xl font-semibold">This quote isn&apos;t available</h1>
      <p className="mt-2 text-sm text-sub">
        The sender may have withdrawn it or replaced the link. Ask them to send it again.
      </p>
    </div>
  );
}

function PublicQuoteView({ token, quote }: { token: string; quote: PublicQuote }) {
  const encoded = encodeURIComponent(token);
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-sub">
          {quote.updatedAt ? `Updated ${formatDate(nairobiDate(quote.updatedAt))}` : null}
        </p>
        <a
          href={`/api/v1/public/quotes/${encoded}/pdf`}
          download
          className="inline-flex items-center gap-2 rounded-panel border border-teal bg-teal px-3.75 py-2.75 text-sm font-medium text-white hover:bg-teal/90"
        >
          <Download aria-hidden className="size-4" />
          Download PDF
        </a>
      </div>
      <InvoicePreview
        {...quotePreviewProps(quote)}
        business={{ ...quote.business, logoKey: null }}
        logoSrc={quote.hasLogo ? `/api/v1/public/quotes/${encoded}/logo` : null}
        showBranding={quote.showBranding}
        statusPill={<QuoteStatusPill status={quote.status} expired={quote.expired} />}
      />
      {quote.expired ? (
        <p className="mt-6 rounded-panel border border-line bg-panel p-5 text-sm">
          This quote expired on {formatDate(quote.validUntil)}. Contact {quote.business.displayName}{" "}
          for a new one.
        </p>
      ) : quote.status === "sent" ? (
        <QuoteResponseForm token={token} quote={quote} />
      ) : quote.status === "accepted" ? (
        <p className="mt-6 flex items-center gap-2 rounded-panel border border-line bg-panel p-5 text-sm">
          <CircleCheckBig aria-hidden className="size-4.5 shrink-0 text-accent" />
          Accepted
          {quote.acceptedBy
            ? ` by ${quote.acceptedBy.name} on ${formatDate(nairobiDate(quote.acceptedBy.at))}`
            : ""}
          .
        </p>
      ) : (
        <p className="mt-6 rounded-panel border border-line bg-panel p-5 text-sm">
          You declined this quote.
        </p>
      )}
      <p className="mt-4 text-center text-sm text-sub">
        Questions about this quote? Contact{" "}
        <a href={`mailto:${quote.business.contactEmail}`} className="text-accent hover:underline">
          {quote.business.contactEmail}
        </a>
        .
      </p>
    </div>
  );
}

async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getPublicQuote(token);
  return quote ? <PublicQuoteView token={token} quote={quote} /> : <Unavailable />;
}

export default function Page({ params }: PageProps<"/q/[token]">) {
  return (
    <main className="flex-1 p-4 sm:p-8">
      <Suspense
        fallback={
          <div className="grid place-items-center py-16">
            <BrandLoader />
          </div>
        }
      >
        <PublicQuotePage params={params} />
      </Suspense>
    </main>
  );
}
