"use client";

import {
  type CreatedQuoteLink,
  type Quote,
  type QuoteLinkStatus,
  quoteEmailDraft,
  quoteWhatsappMessage,
} from "@billsafi/contracts";
import { Copy, Download, Link2, Link2Off, Mail, MessageCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost, apiSend } from "@/lib/api.client";
import { formatAmount, formatDate } from "@/lib/format";

interface QuoteShareDialogProps {
  open: boolean;
  onClose: () => void;
  businessId: string;
  quote: Quote;
  link: QuoteLinkStatus | null;
}

// Tokens are only stored as hashes on the server, so a created link is remembered
// for this browser tab only. The quote editor stores the token under the same key after Send.
const storageKey = (linkId: string) => `billsafi:quote-link:${linkId}`;

function rememberedToken(linkId: string): string | null {
  try {
    return sessionStorage.getItem(storageKey(linkId));
  } catch {
    return null;
  }
}

function forgetToken(linkId: string | undefined) {
  if (!linkId) return;
  try {
    sessionStorage.removeItem(storageKey(linkId));
  } catch {
    // Storage blocked: nothing was kept.
  }
}

export function QuoteShareDialog({
  open,
  onClose,
  businessId,
  quote,
  link,
}: QuoteShareDialogProps) {
  const router = useRouter();
  const [current, setCurrent] = useState<QuoteLinkStatus | null>(link);
  const [token, setToken] = useState<string | null>(() =>
    link && typeof window !== "undefined" ? rememberedToken(link.id) : null,
  );
  const [pending, setPending] = useState<"create" | "disable" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const base = `/businesses/${businessId}/quotes/${quote.id}`;
  const url = token ? `${window.location.origin}/q/${token}` : null;
  const text = url
    ? {
        clientName: quote.client.name,
        quoteNumber: quote.quoteNumber!,
        businessName: quote.business.displayName,
        total: formatAmount(quote.total),
        validUntil: formatDate(quote.validUntil),
        link: url,
      }
    : null;

  async function createLink() {
    setPending("create");
    setError("");
    setMessage("");
    try {
      const created = await apiPost<CreatedQuoteLink>(`${base}/link`, {});
      forgetToken(current?.id);
      try {
        sessionStorage.setItem(storageKey(created.id), created.token);
      } catch {
        // Storage blocked: the link still works for this view.
      }
      setCurrent(created);
      setToken(created.token);
      router.refresh();
    } catch {
      setError("We couldn't create a link. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function disableLink() {
    setPending("disable");
    setError("");
    try {
      await apiSend("DELETE", `${base}/link`);
      forgetToken(current?.id);
      setCurrent(null);
      setToken(null);
      setMessage("The link is disabled. Anyone who opens it will see that it's unavailable.");
    } catch {
      setError("We couldn't disable the link. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setMessage("Link copied.");
  }

  const whatsappHref = text
    ? `https://wa.me/${quote.client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(quoteWhatsappMessage(text))}`
    : null;
  const draft = text ? quoteEmailDraft(text) : null;
  const mailtoHref = draft
    ? `mailto:${quote.client.email ?? ""}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`
    : null;

  const shareButton =
    "inline-flex items-center gap-2 rounded-panel border border-line px-3.25 py-2.25 text-sm hover:bg-soft";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Share ${quote.quoteNumber}`}
      description="Clients can view and accept the quote without an account."
    >
      {url ? (
        <div className="mt-4">
          <label className="text-xs text-sub" htmlFor="share-link">
            Quote link
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="share-link"
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-panel border border-line bg-background p-2.5 text-sm"
            />
            <Button type="button" variant="secondary" onClick={copy}>
              <Copy aria-hidden className="size-4" />
              Copy
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={whatsappHref!} target="_blank" rel="noreferrer" className={shareButton}>
              <MessageCircle aria-hidden className="size-4" />
              WhatsApp
            </a>
            <a href={mailtoHref!} className={shareButton}>
              <Mail aria-hidden className="size-4" />
              Email
            </a>
          </div>
        </div>
      ) : current ? (
        <p className="mt-4 rounded-panel bg-soft p-3 text-sm text-sub">
          A link created on {formatDate(current.createdAt.slice(0, 10))} is active. For security it
          can&apos;t be shown again. Create a new link to share; the old one will stop working.
        </p>
      ) : (
        <p className="mt-4 text-sm text-sub">No active link. Create one to share this quote.</p>
      )}

      <div aria-live="polite">
        <FormMessage tone="success">{message}</FormMessage>
        <FormMessage>{error}</FormMessage>
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-2.5 border-t border-line pt-4">
        <a href={`/api/v1${base}/pdf`} download className={shareButton}>
          <Download aria-hidden className="size-4" />
          Download PDF
        </a>
        <div className="flex flex-wrap gap-2">
          {current && (
            <Button
              type="button"
              variant="ghost"
              pending={pending === "disable"}
              disabled={pending !== null}
              onClick={disableLink}
            >
              <Link2Off aria-hidden className="size-4" />
              Disable link
            </Button>
          )}
          <Button
            type="button"
            pending={pending === "create"}
            disabled={pending !== null}
            onClick={createLink}
          >
            {current ? (
              <RefreshCw aria-hidden className="size-4" />
            ) : (
              <Link2 aria-hidden className="size-4" />
            )}
            {current ? "Create new link" : "Create link"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
