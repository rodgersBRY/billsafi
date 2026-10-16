"use client";

import { FileText, LayoutDashboard, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { segment: "overview", label: "Overview", icon: LayoutDashboard, ready: true },
  { segment: "invoices", label: "Invoices", icon: FileText, ready: false },
  { segment: "clients", label: "Clients", icon: Users, ready: false },
  { segment: "settings", label: "Settings", icon: Settings, ready: false },
] as const;

export function NavLinks({ businessId }: { businessId: string }) {
  const pathname = usePathname();
  const item = "flex items-center gap-2.75 rounded-lg p-2.75 text-sm text-sub transition-colors";

  return (
    <nav aria-label="Main" className="grid gap-1.5">
      {LINKS.map(({ segment, label, icon: Icon, ready }) => {
        const href = `/${businessId}/${segment}`;
        if (!ready) {
          return (
            <span
              key={segment}
              aria-disabled="true"
              className={`${item} cursor-default opacity-60`}
            >
              <Icon aria-hidden className="size-4.5" />
              {label}
              <span className="ml-auto text-xs">Soon</span>
            </span>
          );
        }
        const active = pathname.startsWith(href);
        return (
          <Link
            key={segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`${item} hover:bg-soft hover:text-ink aria-[current=page]:bg-soft aria-[current=page]:font-semibold aria-[current=page]:text-teal`}
          >
            <Icon aria-hidden className="size-4.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
