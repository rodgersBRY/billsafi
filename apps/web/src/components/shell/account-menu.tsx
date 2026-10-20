"use client";

import { CreditCard, Ellipsis, LogOut, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** Account entry pinned to the bottom of the sidebar; the menu opens upward. */
export function AccountMenu({
  name,
  email,
  billingHref,
  settingsHref,
  isPro,
}: {
  name: string;
  email: string;
  billingHref: string;
  settingsHref: string;
  isPro: boolean;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const item =
    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm";

  // Next.js keeps visited pages alive; don't come back to an open menu.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    return () => {
      if (menu) menu.open = false;
    };
  }, []);

  // Close on a click or tap anywhere outside the menu, and on Escape.
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const close = () => {
      menu.open = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (menu.open && !menu.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (menu.open && event.key === "Escape") {
        close();
        menu.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false;
  }

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <details ref={menuRef} className="group relative">
      <summary
        aria-label={`Account menu for ${name}`}
        className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg p-2 hover:bg-soft group-open:bg-soft"
      >
        <span
          aria-hidden
          className="grid size-7.5 shrink-0 place-items-center rounded-full bg-soft text-xs text-accent group-open:bg-panel"
        >
          {initials(name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
        <Ellipsis aria-hidden className="size-4 shrink-0 text-sub" />
      </summary>
      <div className="absolute bottom-full left-0 z-50 mb-2 w-60 rounded-panel border border-line bg-panel p-1.5 shadow-lg">
        <div className="mb-1.5 rounded-lg bg-soft px-2.5 py-2.5">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-sub">{email}</p>
        </div>
        {isPro && (
          <Link href={billingHref} onClick={closeMenu} className={`${item} hover:bg-soft`}>
            Billing
            <CreditCard aria-hidden className="size-4 text-sub" />
          </Link>
        )}
        <Link href={settingsHref} onClick={closeMenu} className={`${item} hover:bg-soft`}>
          Settings
          <Settings aria-hidden className="size-4 text-sub" />
        </Link>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className={`${item} hover:bg-soft disabled:opacity-60`}
        >
          {signingOut ? "Signing out…" : "Sign out"}
          <LogOut aria-hidden className="size-4 text-sub" />
        </button>
        {!isPro && (
          <Link
            href={billingHref}
            onClick={closeMenu}
            className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-lg bg-teal px-2.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal/90"
          >
            <Sparkles aria-hidden className="size-4" />
            Upgrade to Pro
          </Link>
        )}
      </div>
    </details>
  );
}
