"use client";

import { Ellipsis, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { useNavigationPending } from "@/lib/use-navigation-pending";
import { type SidebarMode, sidebarClasses } from "./sidebar-mode";
import { ThemeSwitch } from "./theme-switch";

/** Row style shared by every item in an account menu. */
export const accountMenuItem =
  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-soft";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/**
 * The account entry pinned to the bottom of a sidebar, used by the app and the admin.
 * The menu opens upward with the person's name, the caller's items, the theme switch
 * and sign out. Following any link inside closes it.
 */
export function AccountMenuFrame({
  name,
  email,
  mode = "full",
  dataTour,
  children,
  footer,
}: {
  name: string;
  email: string;
  /** In an icon rail only the initials show. */
  mode?: SidebarMode;
  dataTour?: string;
  /** Items between the name and the theme switch. */
  children?: React.ReactNode;
  /** Shown under sign out, such as the upgrade button. */
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useNavigationPending();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const classes = sidebarClasses(mode);

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
    const onPointerDown = (event: PointerEvent) => {
      if (menu.open && !menu.contains(event.target as Node)) menu.open = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (menu.open && event.key === "Escape") {
        menu.open = false;
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

  function closeOnLink(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a") && menuRef.current) {
      menuRef.current.open = false;
    }
  }

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <details ref={menuRef} data-tour={dataTour} className="group relative">
      <summary
        aria-label={`Account menu for ${name}`}
        className={`flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-lg p-2 hover:bg-soft group-open:bg-soft ${classes.center}`}
      >
        <span
          aria-hidden
          className="grid size-7.5 shrink-0 place-items-center rounded-full bg-soft text-xs text-accent group-open:bg-panel"
        >
          {initials(name)}
        </span>
        <span className={`min-w-0 flex-1 truncate text-sm whitespace-nowrap ${classes.label}`}>
          {name}
        </span>
        <Ellipsis aria-hidden className={`size-4 shrink-0 text-sub ${classes.expandedOnly}`} />
      </summary>
      <div
        onClick={closeOnLink}
        className="absolute bottom-full left-0 z-50 mb-2 w-60 rounded-panel border border-line bg-panel p-1.5 shadow-lg"
      >
        <div className="mb-1.5 rounded-lg bg-soft px-2.5 py-2.5">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-sub">{email}</p>
        </div>
        {children}
        <ThemeSwitch />
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className={`${accountMenuItem} disabled:opacity-60`}
        >
          {signingOut ? "Signing out…" : "Sign out"}
          <LogOut aria-hidden className="size-4 text-sub" />
        </button>
        {footer}
      </div>
    </details>
  );
}
