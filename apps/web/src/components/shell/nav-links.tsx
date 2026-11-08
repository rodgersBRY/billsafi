"use client";

import {
  Crown,
  FileSignature,
  FileText,
  LayoutDashboard,
  Package,
  Repeat,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sidebarClasses } from "./sidebar-mode";

const classes = sidebarClasses("group");

const LINKS = [
  { segment: "overview", label: "Overview", icon: LayoutDashboard },
  { segment: "quotes", label: "Quotes", icon: FileSignature },
  { segment: "invoices", label: "Invoices", icon: FileText },
  { segment: "recurring", label: "Recurring", icon: Repeat, pro: true },
  { segment: "clients", label: "Clients", icon: Users },
  { segment: "items", label: "Items", icon: Package },
] as const;

/**
 * In the rail, labels become tooltips and stay as accessible names. Free accounts see a
 * crown on Pro-only links.
 */
export function NavLinks({ businessId, isPro }: { businessId: string; isPro: boolean }) {
  const pathname = usePathname();
  const item =
    "relative flex items-center gap-2.75 rounded-lg p-2.75 text-sm text-sub transition-colors";

  return (
    <nav aria-label="Main" data-tour="main-nav" className="grid gap-1.5">
      {LINKS.map((link) => {
        const { segment, label, icon: Icon } = link;
        const href = `/${businessId}/${segment}`;
        const active = pathname.startsWith(href);
        const proBadge = "pro" in link && !isPro;
        return (
          <div key={segment} data-tour={`nav-${segment}`} className="group/item relative">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`${item} ${classes.center} hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-[current=page]:bg-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent`}
            >
              <Icon aria-hidden className="size-4.5 shrink-0" />
              <span className={`whitespace-nowrap ${classes.label}`}>{label}</span>
              {proBadge && (
                <>
                  <span className="sr-only">(Pro feature)</span>
                  <span
                    aria-hidden
                    title="Pro feature"
                    className={`ml-auto text-gold ${classes.expandedOnly}`}
                  >
                    <Crown className="size-4" />
                  </span>
                  {/* In the rail the crown sits on the icon's corner. */}
                  <Crown
                    aria-hidden
                    className={`absolute top-1 right-1 size-2.5 text-gold ${classes.railOnly}`}
                  />
                </>
              )}
            </Link>
            <span
              aria-hidden
              className={`pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-panel shadow-md ${classes.tooltip}`}
            >
              {label}
              {proBadge && (
                <Crown className="-mt-0.5 ml-1 inline-block size-3 align-middle text-yellow-300 dark:text-yellow-600" />
              )}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
