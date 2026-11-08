"use client";

import { type WhatsNewLinkSegment, whatsNewLinkLabels } from "@billsafi/contracts";
import { ArrowRight, Crown } from "lucide-react";
import Link from "next/link";

const dateFormat = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Nairobi",
});

export interface WhatsNewEntryCardProps {
  title: string;
  body: string;
  linkSegment: WhatsNewLinkSegment | null;
  pro: boolean;
  /** Null in the admin preview of a draft. */
  publishedAt: string | null;
  unread: boolean;
  businessId: string;
  isPro: boolean;
  onNavigate?: () => void;
  /** Admin preview: links are shown but go nowhere. */
  preview?: boolean;
}

const action =
  "mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-soft";

function EntryLink(props: WhatsNewEntryCardProps) {
  const { linkSegment, pro, isPro, businessId, onNavigate, preview } = props;
  const upgrade = pro && !isPro;
  if (!upgrade && !linkSegment) return null;
  const href = `/${businessId}/${upgrade ? "billing" : linkSegment}`;
  const label = upgrade ? "Upgrade to Pro" : `Open ${whatsNewLinkLabels[linkSegment!]}`;
  const content = (
    <>
      {upgrade && <Crown aria-hidden className="size-4 text-gold" />}
      {label}
      {!upgrade && <ArrowRight aria-hidden className="size-4" />}
    </>
  );
  if (preview) return <span className={action}>{content}</span>;
  return (
    <Link href={href} onClick={onNavigate} className={action}>
      {content}
    </Link>
  );
}

/** One What's new entry, in the panel and in the admin preview. */
export function WhatsNewEntryCard(props: WhatsNewEntryCardProps) {
  const { title, body, pro, publishedAt, unread } = props;
  return (
    <article className="px-5 py-4">
      <p className="flex items-center gap-2 text-xs text-sub">
        {publishedAt ? dateFormat.format(new Date(publishedAt)) : "Not published"}
        {pro && (
          <span className="inline-flex items-center gap-1 font-medium text-gold">
            <Crown aria-hidden className="size-3" />
            Pro
          </span>
        )}
        {unread && (
          <span className="rounded-full bg-teal px-1.5 py-0.5 font-semibold text-white">New</span>
        )}
      </p>
      <h3 className="mt-1 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm whitespace-pre-line text-sub">{body}</p>
      <EntryLink {...props} />
    </article>
  );
}
