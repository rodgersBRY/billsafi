"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface AppShellProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

/** Left navigation on desktop; a top-left menu on smaller screens (D039, D040). */
export function AppShell({ sidebar, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile menu after navigating.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to route changes
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-full flex-1">
      <aside
        id="app-navigation"
        className={`fixed inset-y-0 left-0 z-40 w-64 flex-col gap-6 border-r border-line bg-panel px-4.5 py-6.75 md:sticky md:top-0 md:flex md:h-dvh md:w-52.5 ${
          menuOpen ? "flex" : "hidden"
        }`}
      >
        {sidebar}
      </aside>
      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-panel px-4 py-3.5 sm:px-7 md:hidden">
          <button
            type="button"
            aria-controls="app-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-panel p-2 text-sub hover:bg-soft hover:text-ink md:hidden"
          >
            {menuOpen ? (
              <X aria-hidden className="size-5" />
            ) : (
              <Menu aria-hidden className="size-5" />
            )}
            <span className="sr-only">Menu</span>
          </button>
        </header>
        <main className="flex-1 p-4 sm:p-7.5">{children}</main>
      </div>
    </div>
  );
}
