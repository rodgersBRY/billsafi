"use client";

import { LoaderCircle } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";

function PendingMark() {
  const { pending } = useLinkStatus();
  return pending ? (
    <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:hidden" />
  ) : null;
}

interface AdminLinkProps {
  href: string;
  current?: boolean;
  /** Swap the history entry instead of adding one, for options within a tab. */
  replace?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** A dashboard link that only changes the URL and shows a spinner while the view loads. */
export function AdminLink({ href, current, replace, className = "", children }: AdminLinkProps) {
  return (
    <Link
      href={href}
      replace={replace}
      scroll={!replace}
      aria-current={current ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      {children}
      <PendingMark />
    </Link>
  );
}

/** A table row that opens `href` when clicked; the row's own link covers keyboard use. */
export function ClickableRow({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) return;
        router.push(href);
      }}
      className="cursor-pointer border-t border-line hover:bg-background/60"
    >
      {children}
    </tr>
  );
}
