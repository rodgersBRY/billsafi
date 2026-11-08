"use client";

import { Megaphone } from "lucide-react";
import { useEffect } from "react";
import { sidebarClasses } from "@/components/shell/sidebar-mode";
import { loadWhatsNew, openWhatsNew, useWhatsNew } from "./whats-new-store";

const classes = sidebarClasses("group");
const item =
  "relative flex w-full items-center gap-2.75 rounded-lg p-2.75 text-sm text-sub transition-colors";

/** Sidebar entry to the What's new panel, with the unread count. */
export function WhatsNewButton({ userId }: { userId: string }) {
  const { feed } = useWhatsNew();
  const count = feed?.unreadCount ?? 0;

  useEffect(() => {
    void loadWhatsNew(userId);
  }, [userId]);

  return (
    <div data-tour="whats-new" className="group/item relative">
      <button
        type="button"
        onClick={openWhatsNew}
        className={`${item} ${classes.center} hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent`}
      >
        <Megaphone aria-hidden className="size-4.5 shrink-0" />
        {count > 0 && (
          <span
            aria-hidden
            className={`absolute top-2 right-2 size-2 rounded-full bg-teal ${classes.railOnly}`}
          />
        )}
        <span className={`whitespace-nowrap ${classes.label}`}>What&apos;s new</span>
        {count > 0 && (
          <>
            <span
              aria-hidden
              className={`ml-auto rounded-full bg-teal px-1.5 text-xs font-semibold text-white ${classes.expandedOnly}`}
            >
              {count}
            </span>
            <span className="sr-only">({count} unread)</span>
          </>
        )}
      </button>
      <span
        aria-hidden
        className={`pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-panel shadow-md ${classes.tooltip}`}
      >
        What&apos;s new
      </span>
    </div>
  );
}
