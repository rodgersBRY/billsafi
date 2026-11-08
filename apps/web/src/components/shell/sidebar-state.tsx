"use client";

import { ChevronLeft } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { type SidebarMode, sidebarClasses } from "./sidebar-mode";

/**
 * The collapse state of a sidebar, remembered in this browser under `storageKey`.
 * "auto" until the visitor picks one.
 */
export function useSidebarMode(storageKey: string) {
  const [mode, setMode] = useState<SidebarMode>("auto");
  const [wide, setWide] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage once
      if (saved === "rail" || saved === "full") setMode(saved);
    } catch {
      // Storage blocked: keep following the screen width.
    }
  }, [storageKey]);

  // In "auto" the sidebar is full from 1280px; the chevron needs to know which way to point.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const onChange = () => setWide(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const expanded = mode === "full" || (mode === "auto" && wide);

  function choose(next: SidebarMode) {
    setMode(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Storage blocked: the choice lasts until the page reloads.
    }
  }

  return {
    mode,
    expanded,
    toggle: () => choose(expanded ? "rail" : "full"),
    expand: () => choose("full"),
  };
}

/** The round chevron on the sidebar's edge, half over the content. */
export function SidebarToggle({
  expanded,
  onToggle,
  className = "",
}: {
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const label = expanded ? "Collapse navigation" : "Expand navigation";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={label}
      title={label}
      className={`absolute bottom-1/6 -right-5 place-items-center rounded-full border border-line bg-panel text-sub shadow-sm hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent size-10 ${className || "grid"}`}
    >
      <ChevronLeft
        aria-hidden
        className={`size-4.5 transition-transform duration-200 motion-reduce:transition-none ${expanded ? "" : "rotate-180"}`}
      />
    </button>
  );
}

interface SidebarContextValue {
  /** Opens the full sidebar, such as when a rail icon needs more room. */
  expand: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({ expand: () => {} });

export const SidebarProvider = SidebarContext.Provider;

/** Sidebar actions for anything rendered inside the app sidebar. */
export function useSidebar() {
  return useContext(SidebarContext);
}

/** Children show only while the sidebar is full, such as the version line. */
export function SidebarExpandedOnly({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`${sidebarClasses("group").expandedBlock} ${className}`}>{children}</div>;
}
