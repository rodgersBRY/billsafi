"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function AccountMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);

  // Next.js keeps visited pages alive; don't come back to an open menu.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    return () => {
      if (menu) menu.open = false;
    };
  }, []);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <details ref={menuRef} className="relative">
      <summary
        aria-label={`Account menu for ${name}`}
        className="flex cursor-pointer list-none items-center gap-2.5 rounded-panel p-1 hover:bg-soft"
      >
        <span className="hidden text-right sm:block">
          <span className="block text-sm leading-tight">{name}</span>
          <span className="block text-xs text-sub">{email}</span>
        </span>
        <span
          aria-hidden
          className="grid size-7.5 place-items-center rounded-full bg-soft text-xs text-teal"
        >
          {initials(name)}
        </span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-56 rounded-panel border border-line bg-panel p-1.5 shadow-lg">
        <p className="px-2.5 py-2 text-xs text-sub sm:hidden">{email}</p>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-soft disabled:opacity-60"
        >
          <LogOut aria-hidden className="size-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </details>
  );
}
