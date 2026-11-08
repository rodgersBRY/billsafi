"use client";

import { type WhatsNewLinkSegment, whatsNewLinkLabels } from "@billsafi/contracts";
import {
  ArrowRight,
  Crown,
  CreditCard,
  FileSignature,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  Package,
  Repeat,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";

const dateFormat = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Nairobi",
});

/** The same icons as the sidebar, so a card shows where the feature lives. */
const PAGE_ICONS: Record<WhatsNewLinkSegment, LucideIcon> = {
  overview: LayoutDashboard,
  quotes: FileSignature,
  invoices: FileText,
  recurring: Repeat,
  clients: Users,
  items: Package,
  settings: Settings,
  billing: CreditCard,
};

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
  "mt-2 inline-flex min-h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function EntryAction(props: WhatsNewEntryCardProps) {
  const { linkSegment, pro, isPro, businessId, onNavigate, preview } = props;
  const upgrade = pro && !isPro;
  if (!upgrade && !linkSegment) return null;
  const href = `/${businessId}/${upgrade ? "billing" : linkSegment}`;
  const style = upgrade
    ? `${action} bg-teal text-white hover:bg-teal/90`
    : `${action} -ml-2.5 text-accent hover:bg-soft`;
  const content = upgrade ? (
    <>
      <Crown aria-hidden className="size-3.5 text-yellow-300" />
      Upgrade to Pro
    </>
  ) : (
    <>
      Open {whatsNewLinkLabels[linkSegment!]}
      <ArrowRight aria-hidden className="size-3.5" />
    </>
  );
  if (preview) return <span className={style}>{content}</span>;
  return (
    <Link href={href} onClick={onNavigate} className={style}>
      {content}
    </Link>
  );
}

/** One What's new entry, in the panel and in the admin preview. */
export function WhatsNewEntryCard(props: WhatsNewEntryCardProps) {
  const { title, body, linkSegment, pro, publishedAt, unread } = props;
  const Icon = linkSegment ? PAGE_ICONS[linkSegment] : Megaphone;

  return (
    <article
      className={`relative flex gap-3 rounded-panel border bg-panel p-3 shadow-sm ${
        unread ? "border-teal/40 ring-1 ring-teal/20" : "border-line"
      }`}
    >
      <span
        aria-hidden
        className={`grid size-8 shrink-0 place-items-center rounded-md ${
          pro ? "bg-gold/15 text-gold" : "bg-soft text-accent"
        }`}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs/4 text-sub">
          <span>{publishedAt ? dateFormat.format(new Date(publishedAt)) : "Not published"}</span>
          {pro && (
            <span className="inline-flex items-center gap-1 font-semibold text-gold">
              <Crown aria-hidden className="size-3" />
              Pro
            </span>
          )}
          {unread && (
            <span className="ml-auto rounded-full bg-teal px-1.5 text-xs/4 font-semibold text-white">
              New
            </span>
          )}
        </p>
        <h4 className="mt-1 text-sm/5 font-semibold text-balance wrap-break-word text-ink">
          {title}
        </h4>
        <p className="mt-0.5 text-xs/5 whitespace-pre-line wrap-break-word text-sub">{body}</p>
        <EntryAction {...props} />
      </div>
    </article>
  );
}
