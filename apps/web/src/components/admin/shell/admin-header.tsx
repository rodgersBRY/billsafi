"use client";

import { ChevronRight, Code, FlaskConical, Menu, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminCrumbs } from "./admin-nav";

import type { AdminEnvironment } from "./admin-environment";

interface AdminHeaderProps {
  environment: AdminEnvironment;
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
  onOpenMenu: () => void;
}

const iconButton =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-panel px-2.5 text-sm text-sub hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:min-h-9";

const environments = {
  production: {
    label: "Production",
    icon: ShieldAlert,
    tone: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  },
  staging: {
    label: "Staging",
    icon: FlaskConical,
    tone: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  development: {
    label: "Development",
    icon: Code,
    tone: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
} as const;

function EnvironmentBadge({ environment }: { environment: AdminEnvironment }) {
  const { label, icon: Icon, tone } = environments[environment];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${tone}`}
    >
      <Icon aria-hidden className="size-3.5" />
      <span className="sr-only">Environment: </span>
      {label}
    </span>
  );
}

/**
 * Sticky header: menu button on phones, breadcrumbs and the environment. The account,
 * the way back to the app and sign out live in the sidebar's account menu.
 */
export function AdminHeader({ environment, menuButtonRef, onOpenMenu }: AdminHeaderProps) {
  const pathname = usePathname();
  const crumbs = adminCrumbs(pathname);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-panel px-2 py-2 sm:px-4 lg:px-6">
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onOpenMenu}
        aria-haspopup="dialog"
        className={`${iconButton} md:hidden`}
      >
        <Menu aria-hidden className="size-5" />
        <span className="sr-only">Open navigation</span>
      </button>
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1 text-sm">
          {crumbs.map((crumb, index) => (
            <li
              key={crumb.label}
              // On phones only the last two crumbs fit.
              className={`flex min-w-0 items-center gap-1 ${index < crumbs.length - 2 ? "hidden sm:flex" : ""}`}
            >
              {index > 0 && (
                <ChevronRight
                  aria-hidden
                  className={`size-3.5 shrink-0 text-sub ${index === crumbs.length - 2 ? "hidden sm:block" : ""}`}
                />
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate text-sub hover:text-ink hover:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="truncate font-medium">
                  {crumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <EnvironmentBadge environment={environment} />
    </header>
  );
}
