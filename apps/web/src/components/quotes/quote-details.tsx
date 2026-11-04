"use client";

import type { Quote, QuoteLinkStatus, QuoteVersion } from "@billsafi/contracts";
import {
  ArrowRightLeft,
  Ban,
  CalendarPlus,
  CircleCheckBig,
  CircleX,
  Copy,
  Download,
  Pencil,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form-message";
import { QuoteStatusPill } from "@/components/ui/quote-status-pill";
import { apiPost } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import { logoUrl } from "@/lib/logo";
import { quotePreviewProps } from "./quote-preview-props";
import { QuoteShareDialog } from "./quote-share-dialog";

interface QuoteDetailsProps {
  businessId: string;
  quote: Quote;
  link: QuoteLinkStatus | null;
  /** Set when viewing an older version. */
  version?: QuoteVersion;
}

type Open = "share" | "confirm-convert" | "withdraw" | null;
type Busy = "convert" | "withdraw" | "duplicate" | null;

const actionLink =
  "inline-flex items-center gap-2 rounded-panel border border-line bg-panel px-3.75 py-2.75 text-sm font-medium hover:bg-soft";
const primaryLink =
  "inline-flex items-center gap-2 rounded-panel border border-teal bg-teal px-3.75 py-2.75 text-sm font-medium text-white hover:bg-teal/90";

export function QuoteDetails({ businessId, quote, link, version }: QuoteDetailsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState<Open>(() =>
    searchParams.get("share") === "1" ? "share" : null,
  );
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState("");

  // Strip ?share=1 so a refresh doesn't reopen the dialog.
  useEffect(() => {
    if (searchParams.get("share") !== "1") return;
    const rest = new URLSearchParams(searchParams);
    rest.delete("share");
    const queryString = rest.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }, [searchParams, pathname, router]);

  const base = `/businesses/${businessId}/quotes/${quote.id}`;
  const detailsPath = `/${businessId}/quotes/${quote.id}`;
  const editHref = `${detailsPath}/edit`;
  const shown = quote.expired ? "expired" : quote.status;
  const close = () => setOpen(null);
  const response = quote.response;
  const showResponse =
    response !== null &&
    (quote.status === "accepted" || quote.status === "converted" || quote.status === "declined");

  async function convert(confirmUnaccepted: boolean) {
    setBusy("convert");
    setError("");
    try {
      const result = await apiPost<{ invoiceId: string }>(
        `${base}/convert`,
        confirmUnaccepted ? { confirmUnaccepted: true } : {},
      );
      router.push(`/${businessId}/invoices/${result.invoiceId}`);
    } catch (failure) {
      setOpen(null);
      setBusy(null);
      if (failure instanceof ApiError && failure.status === 400 && failure.fieldErrors().clientId) {
        setError("This client is archived. Restore the client to convert this quote.");
      } else {
        setError(failure instanceof ApiError ? failure.message : "Something went wrong.");
      }
    }
  }

  function startConvert() {
    if (quote.status === "sent") setOpen("confirm-convert");
    else void convert(false);
  }

  async function withdraw() {
    setBusy("withdraw");
    setError("");
    try {
      await apiPost<Quote>(`${base}/withdraw`, {});
      setOpen(null);
      router.refresh();
    } catch (failure) {
      setOpen(null);
      setError(failure instanceof ApiError ? failure.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function duplicate() {
    setBusy("duplicate");
    setError("");
    try {
      const copy = await apiPost<Quote>(`${base}/duplicate`, {});
      router.push(`/${businessId}/quotes/${copy.id}/edit`);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Something went wrong.");
      setBusy(null);
    }
  }

  const shareButton = (
    <Button type="button" variant="secondary" onClick={() => setOpen("share")}>
      <Share2 aria-hidden className="size-4" />
      Share
    </Button>
  );
  const convertButton = (primary: boolean) => (
    <Button
      type="button"
      variant={primary ? "primary" : "secondary"}
      pending={busy === "convert"}
      onClick={startConvert}
    >
      <ArrowRightLeft aria-hidden className="size-4" />
      Convert to invoice
    </Button>
  );
  const withdrawButton = (
    <Button type="button" variant="ghost" onClick={() => setOpen("withdraw")}>
      <Ban aria-hidden className="size-4" />
      Withdraw
    </Button>
  );
  const duplicateButton = (
    <Button type="button" variant="secondary" pending={busy === "duplicate"} onClick={duplicate}>
      <Copy aria-hidden className="size-4" />
      Duplicate
    </Button>
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <p className="text-xs text-sub">
            <Link href={`/${businessId}/quotes`} className="hover:underline">
              Quotes
            </Link>{" "}
            / {quote.quoteNumber ?? "Draft quote"}
          </p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {quote.quoteNumber ?? "Draft quote"}
            <QuoteStatusPill status={quote.status} expired={quote.expired} />
          </h1>
          <p className="mt-1 text-sm text-sub">
            {quote.client.name} · valid until {formatDate(quote.validUntil)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {shown === "sent" && (
            <>
              {shareButton}
              <Link href={editHref} className={actionLink}>
                <Pencil aria-hidden className="size-4" />
                Edit
              </Link>
              {convertButton(false)}
              {withdrawButton}
            </>
          )}
          {shown === "expired" && (
            <>
              <Link href={editHref} className={actionLink}>
                <CalendarPlus aria-hidden className="size-4" />
                Extend
              </Link>
              {withdrawButton}
            </>
          )}
          {shown === "declined" && (
            <>
              <Link href={editHref} className={actionLink}>
                <Pencil aria-hidden className="size-4" />
                Edit and resend
              </Link>
              {withdrawButton}
            </>
          )}
          {shown === "accepted" && (
            <>
              {convertButton(true)}
              {duplicateButton}
            </>
          )}
          {shown === "converted" && (
            <>
              {quote.convertedInvoiceId && (
                <Link
                  href={`/${businessId}/invoices/${quote.convertedInvoiceId}`}
                  className={primaryLink}
                >
                  View invoice
                </Link>
              )}
              {duplicateButton}
            </>
          )}
          {shown === "withdrawn" && duplicateButton}
          <a href={`/api/v1${base}/pdf`} download className={actionLink}>
            <Download aria-hidden className="size-4" />
            Download PDF
          </a>
        </div>
      </div>
      <FormMessage>{error}</FormMessage>

      {version && (
        <p className="mb-4 rounded-panel bg-soft p-3 text-sm text-sub">
          You&apos;re viewing version {version.version} from{" "}
          {formatDate(version.createdAt.slice(0, 10))}. The client sees version {quote.version}.{" "}
          <Link href={detailsPath} className="font-medium text-ink underline">
            Back to current
          </Link>
        </p>
      )}

      <div className="mt-4 grid gap-5.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3.5">
          {showResponse && response && (
            <section
              aria-label="Client response"
              className="rounded-panel border border-line bg-panel p-5"
            >
              {response.decision === "accepted" ? (
                <>
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <CircleCheckBig aria-hidden className="size-4.5 text-accent" />
                    Accepted by {response.signerName}
                  </h2>
                  <p className="mt-1 text-sm text-sub">
                    {formatDate(response.createdAt.slice(0, 10))} · version {response.version}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <CircleX aria-hidden className="size-4.5 text-red-700" />
                    Declined
                  </h2>
                  <p className="mt-1 text-sm">
                    {response.reason ? `“${response.reason}”` : "No reason given"}
                  </p>
                  <p className="mt-1 text-sm text-sub">
                    {formatDate(response.createdAt.slice(0, 10))}
                  </p>
                </>
              )}
            </section>
          )}

          {quote.versions.length > 1 && (
            <section className="rounded-panel border border-line bg-panel p-5">
              <h2 className="text-base font-semibold">Versions</h2>
              <ul className="mt-3 divide-y divide-line">
                {quote.versions.map((item) => (
                  <li key={item.version} className="flex items-center justify-between gap-2 py-2">
                    <Link
                      href={`${detailsPath}?version=${item.version}`}
                      className="text-sm hover:underline"
                    >
                      Version {item.version} · {formatDate(item.createdAt.slice(0, 10))}
                    </Link>
                    {item.version === quote.version && (
                      <span className="rounded-md bg-background px-1.75 py-1 text-xs text-sub">
                        Current
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <InvoicePreview
            {...quotePreviewProps(version?.content ?? quote)}
            business={quote.business}
            logoSrc={quote.business.logoKey ? logoUrl(businessId, quote.business.logoKey) : null}
            statusPill={<QuoteStatusPill status={quote.status} expired={quote.expired} />}
          />
        </div>
      </div>

      {open === "share" && (
        <QuoteShareDialog open onClose={close} businessId={businessId} quote={quote} link={link} />
      )}
      <Dialog
        open={open === "confirm-convert"}
        onClose={close}
        title="Client hasn't accepted on the link. Convert anyway?"
      >
        <div className="mt-5 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={close}>
            Keep waiting
          </Button>
          <Button type="button" pending={busy === "convert"} onClick={() => convert(true)}>
            Convert anyway
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={open === "withdraw"}
        onClose={close}
        title="Withdraw this quote?"
        description="The link stops working. You can't undo this."
      >
        <div className="mt-5 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="button" pending={busy === "withdraw"} onClick={withdraw}>
            Withdraw
          </Button>
        </div>
      </Dialog>
    </>
  );
}
