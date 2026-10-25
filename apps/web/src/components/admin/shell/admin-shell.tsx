"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminToastProvider } from "../admin-toast";
import { AdminDrawer } from "./admin-drawer";
import { type AdminEnvironment, AdminHeader } from "./admin-header";
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

  function closeDrawer() {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <AdminToastProvider>
      <div className="flex min-h-full flex-1">
        <aside
          className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-panel p-3 md:flex xl:w-64 xl:p-4 ${railOpen ? "w-64" : "w-17"}`}
        >
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
