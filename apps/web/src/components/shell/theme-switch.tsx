"use client";

import { Moon } from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";

/** "Dark mode" row with an on/off switch, for the account menu. */
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const dark = useTheme() === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-soft ${className}`}
    >
      <span className="flex items-center gap-2">
        <Moon aria-hidden className="size-4 text-sub" />
        Dark mode
      </span>
      <span
        aria-hidden
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          dark ? "bg-teal" : "bg-line"
        }`}
      >
        <span
          className={`size-4 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${
            dark ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
