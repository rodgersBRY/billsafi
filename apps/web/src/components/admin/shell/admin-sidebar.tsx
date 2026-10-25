"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavItem, adminNav } from "./admin-nav";

/**
 * The module list. `compact` turns it into an icon rail below 1280px: labels become
 * tooltips (and stay as accessible names); from 1280px labels always show.
 */
export function AdminSidebar({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const active = activeNavItem(pathname);
  const hideLabel = compact ? "sr-only xl:not-sr-only" : "";

  return (
    <>
      <Link
        href="/admin"
        className={`flex min-h-11 items-center gap-2.5 rounded-panel px-2 ${compact ? "justify-center xl:justify-start" : ""}`}
      >
        <Image src="/brand/logo-mark.png" alt="" width={28} height={28} className="rounded-lg" />
        <span className={`text-lg font-semibold tracking-tight text-accent ${hideLabel}`}>
          BillSafi
        </span>
        <span
          className={`rounded-md bg-soft px-1.5 py-0.5 text-xs font-medium text-accent ${compact ? "hidden xl:inline" : ""}`}
        >
          Admin
        </span>
      </Link>
      <nav aria-label="Admin modules" className="mt-6">
        <ul className="grid gap-1">
          {adminNav.map((item) => {
            const current = item === active;
            const Icon = item.icon;
            return (
              <li key={item.href} className="group relative">
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-panel px-2.5 text-sm hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-[current=page]:bg-soft aria-[current=page]:font-medium aria-[current=page]:text-accent ${compact ? "justify-center xl:justify-start" : ""} ${current ? "" : "text-sub"}`}
                >
                  <Icon aria-hidden className="size-4.5 shrink-0" />
                  <span className={hideLabel}>{item.label}</span>
                </Link>
                {compact && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-full z-50 ml-2 hidden -translate-y-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-panel shadow-md group-focus-within:block group-hover:block xl:hidden!"
                  >
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
