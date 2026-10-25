"use client";

import { ArrowLeft, ChevronRight, Code, LogOut, Menu, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useNavigationPending } from "@/lib/use-navigation-pending";
import { adminCrumbs } from "./admin-nav";

export type AdminEnvironment = "production" | "development";

interface AdminHeaderProps {
  user: { name: string; email: string };
  environment: AdminEnvironment;
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
  onOpenMenu: () => void;
}

const iconButton =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-panel px-2.5 text-sm text-sub hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:min-h-9";

function EnvironmentBadge({ environment }: { environment: AdminEnvironment }) {
  const production = environment === "production";
  const Icon = production ? ShieldAlert : Code;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${
        production
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
      }`}
    >
      <Icon aria-hidden className="size-3.5" />
      <span className="sr-only">Environment: </span>
      {production ? "Production" : "Development"}
    </span>
  );
}

/** Sticky header: menu button on phones, breadcrumbs, environment, way back, sign out. */
export function AdminHeader({ user, environment, menuButtonRef, onOpenMenu }: AdminHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useNavigationPending();
  const crumbs = adminCrumbs(pathname);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

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
      <Link href="/" className={iconButton}>
        <ArrowLeft aria-hidden className="size-4" />
        <span className="sr-only lg:not-sr-only">Back to app</span>
      </Link>
      <div className="hidden min-w-0 text-right lg:block">
        <p className="max-w-40 truncate text-sm font-medium">{user.name}</p>
        <p className="max-w-40 truncate text-xs text-sub">{user.email}</p>
      </div>
      <button type="button" onClick={signOut} disabled={signingOut} className={iconButton}>
        <LogOut aria-hidden className="size-4" />
        <span className="sr-only xl:not-sr-only">{signingOut ? "Signing out" : "Sign out"}</span>
      </button>
    </header>
  );
}
