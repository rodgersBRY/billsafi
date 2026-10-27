"use client";

import { ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type SidebarMode, sidebarClasses } from "@/components/shell/sidebar-mode";
import { AdminToastProvider } from "../admin-toast";
import { AdminAccountMenu } from "./admin-account-menu";
import { AdminDrawer } from "./admin-drawer";
import type { AdminEnvironment } from "./admin-environment";
import { AdminHeader } from "./admin-header";
import { AdminSidebar } from "./admin-sidebar";

const SIDEBAR_KEY = "billsafi:admin-sidebar";

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
  const [mode, setMode] = useState<SidebarMode>("auto");
  const [wide, setWide] = useState(false);
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

  // Remember the visitor's choice in this browser; "auto" until they pick one.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage once
      if (saved === "rail" || saved === "full") setMode(saved);
    } catch {
      // Storage blocked: keep following the screen width.
    }
  }, []);

  // In "auto" the sidebar is full from 1280px; the chevron needs to know which way to point.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const onChange = () => setWide(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const expanded = mode === "full" || (mode === "auto" && wide);
  const classes = sidebarClasses(mode);

  function toggleSidebar() {
    const next: SidebarMode = expanded ? "rail" : "full";
    setMode(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, next);
    } catch {
      // Storage blocked: the choice lasts until the page reloads.
    }
  }

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
          className={`relative z-40 hidden shrink-0 border-r border-line bg-panel transition-[width] duration-200 ease-out motion-reduce:transition-none md:block ${classes.width}`}
        >
          <div className="sticky top-0 flex h-dvh flex-col p-3 xl:p-4">
            <AdminSidebar mode={mode} />
            <div className="mt-auto">
              <AdminAccountMenu user={user} mode={mode} />
            </div>
            {/* Sits on the sidebar's edge, half over the content. */}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
              title={expanded ? "Collapse navigation" : "Expand navigation"}
              className="absolute bottom-1/6 -right-5 grid size-10 place-items-center rounded-full border border-line bg-panel text-sub shadow-sm hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ChevronLeft
                aria-hidden
                className={`size-4.5 transition-transform duration-200 motion-reduce:transition-none ${expanded ? "" : "rotate-180"}`}
              />
            </button>
          </div>
        </aside>
        <AdminDrawer open={drawerOpen} onClose={closeDrawer}>
          {drawerOpen && (
            <>
              <AdminSidebar mode="full" />
              <div className="mt-auto">
                <AdminAccountMenu user={user} />
              </div>
            </>
          )}
        </AdminDrawer>
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader
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
