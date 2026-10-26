"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef } from "react";

/**
 * An info button that opens a small popover with a definition. It uses the browser's
 * own popover: Enter, Space or a tap opens it, Escape or a click outside closes it and
 * focus goes back to the button. It is placed beside the button and kept inside the screen.
 */
export function InfoPopover({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = card.current;
    const trigger = button.current;
    if (!node || !trigger) return;
    const place = () => {
      const box = trigger.getBoundingClientRect();
      const width = Math.min(288, window.innerWidth - 32);
      const left = Math.min(
        Math.max(box.left + box.width / 2 - width / 2, 16),
        window.innerWidth - width - 16,
      );
      node.style.width = `${width}px`;
      node.style.left = `${left}px`;
      node.style.top = `${box.bottom + 6}px`;
    };
    const close = () => {
      if (node.matches(":popover-open")) node.hidePopover();
    };
    const onToggle = (event: Event) => {
      if ((event as ToggleEvent).newState === "open") place();
    };
    node.addEventListener("toggle", onToggle);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      node.removeEventListener("toggle", onToggle);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, []);

  return (
    <>
      <button
        ref={button}
        type="button"
        popoverTarget={id}
        aria-label={label}
        className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent md:size-6"
      >
        <Info aria-hidden className="size-4" />
      </button>
      <div
        ref={card}
        id={id}
        popover="auto"
        className="fixed m-0 rounded-panel border border-line bg-panel p-3 text-left text-xs font-normal text-ink shadow-md"
      >
        {children}
      </div>
    </>
  );
}
