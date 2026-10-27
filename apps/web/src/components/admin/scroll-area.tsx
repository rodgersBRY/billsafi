"use client";

import { MoveRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Wide content that scrolls sideways inside its box, never the page. While columns are
 * hidden past the edge, a fade and a "Scroll for more" hint say so.
 */
export function ScrollArea({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const update = () => setMore(box.scrollLeft + box.clientWidth < box.scrollWidth - 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    box.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      box.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div className="relative">
      <div
        ref={ref}
        // Focusable so keyboard users can scroll it; named for screen readers.
        tabIndex={0}
        role="region"
        aria-label={label}
        // Positioned, so screen-reader-only text in cells stays inside the scroll box.
        className="relative overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        {children}
      </div>
      {more && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-panel to-transparent"
          />
          <p
            aria-hidden
            className="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1 rounded-md border border-line bg-panel px-2 py-1 text-xs text-sub shadow-sm"
          >
            Scroll for more
            <MoveRight className="size-3.5" />
          </p>
        </>
      )}
    </div>
  );
}
