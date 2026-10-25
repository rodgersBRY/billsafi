"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminToastProvider } from "../admin-toast";
import { AdminDrawer } from "./admin-drawer";
import type { AdminEnvironment } from "./admin-environment";
import { AdminHeader } from "./admin-header";
import { AdminSidebar } from "./admin-sidebar";

interface AdminShellProps {
  user: { name: string; email: string };
  environment: AdminEnvironment;
  children: React.ReactNode;
}

/**
 * The admin frame: a 256px sidebar from 1280px, an icon rail that expands from 768px,
 * and a drawer behind a menu button on phones.
 */
export function AdminShell({ user, environment, children }: AdminShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close the drawer after navigating.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to route changes
    setDrawerOpen(false);
  }, [pathname]);

  // The drawer only exists below 768px; close it if the window grows past that.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (query.matches) setDrawerOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  function closeDrawer() {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <AdminToastProvider>
      <div className="flex min-h-full flex-1">
        {/* The outer column stretches with the page so its background and border run the
            full height; the inner block stays pinned to the viewport. */}
        <aside
          className={`hidden shrink-0 border-r border-line bg-panel md:block xl:w-64 ${railOpen ? "w-64" : "w-17"}`}
        >
          <div className="sticky top-0 flex h-dvh flex-col p-3 xl:p-4">
            <AdminSidebar compact={!railOpen} />
            <button
              type="button"
              onClick={() => setRailOpen((open) => !open)}
              aria-expanded={railOpen}
              className={`mt-auto flex min-h-11 items-center gap-3 rounded-panel px-2.5 text-sm text-sub hover:bg-soft hover:text-ink xl:hidden ${railOpen ? "" : "justify-center"}`}
            >
              {railOpen ? (
                <PanelLeftClose aria-hidden className="size-4.5" />
              ) : (
                <PanelLeftOpen aria-hidden className="size-4.5" />
              )}
              <span className={railOpen ? "" : "sr-only"}>
                {railOpen ? "Collapse navigation" : "Expand navigation"}
              </span>
            </button>
          </div>
        </aside>
        <AdminDrawer open={drawerOpen} onClose={closeDrawer}>
          {drawerOpen && <AdminSidebar />}
        </AdminDrawer>
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader
            user={user}
            environment={environment}
            menuButtonRef={menuButtonRef}
            onOpenMenu={() => setDrawerOpen(true)}
          />
          <main className="mx-auto w-full max-w-400 min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </AdminToastProvider>
  );
}
