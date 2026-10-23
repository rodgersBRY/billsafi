"use client";

import { FileText, LayoutDashboard, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { segment: "overview", label: "Overview", icon: LayoutDashboard },
  { segment: "invoices", label: "Invoices", icon: FileText },
  { segment: "clients", label: "Clients", icon: Users },
] as const;

export function NavLinks({ businessId }: { businessId: string }) {
  const pathname = usePathname();
  const item = "flex items-center gap-2.75 rounded-lg p-2.75 text-sm text-sub transition-colors";

  return (
    <nav aria-label="Main" data-tour="main-nav" className="grid gap-1.5">
      {LINKS.map(({ segment, label, icon: Icon }) => {
        const href = `/${businessId}/${segment}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`${item} hover:bg-soft hover:text-ink aria-[current=page]:bg-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent`}
          >
            <Icon aria-hidden className="size-4.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
