"use client";

import { FileSignature, FileText, LayoutDashboard, Package, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sidebarClasses } from "./sidebar-mode";

const classes = sidebarClasses("group");

const LINKS = [
  { segment: "overview", label: "Overview", icon: LayoutDashboard },
  { segment: "quotes", label: "Quotes", icon: FileSignature },
  { segment: "invoices", label: "Invoices", icon: FileText },
  { segment: "clients", label: "Clients", icon: Users },
  { segment: "items", label: "Items", icon: Package },
] as const;

/** In the rail, labels become tooltips and stay as accessible names. */
export function NavLinks({ businessId }: { businessId: string }) {
  const pathname = usePathname();
  const item = "flex items-center gap-2.75 rounded-lg p-2.75 text-sm text-sub transition-colors";

  return (
    <nav aria-label="Main" data-tour="main-nav" className="grid gap-1.5">
      {LINKS.map(({ segment, label, icon: Icon }) => {
        const href = `/${businessId}/${segment}`;
        const active = pathname.startsWith(href);
        return (
          <div key={segment} className="group/item relative">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`${item} ${classes.center} hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-[current=page]:bg-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent`}
            >
              <Icon aria-hidden className="size-4.5 shrink-0" />
              <span className={`whitespace-nowrap ${classes.label}`}>{label}</span>
            </Link>
            <span
              aria-hidden
              className={`pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-panel shadow-md ${classes.tooltip}`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
