"use client";

import { Info } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

/** Only one info card is open at a time: the open one's closer lives here. */
let openId: string | null = null;
let closeOpen: (() => void) | null = null;

const CLOSE_DELAY_MS = 120;

/**
 * An info button that shows a short definition like a tooltip. A mouse opens it on hover and
 * closes it shortly after the pointer leaves the button and the card; the keyboard opens it on
 * focus and Escape closes it and keeps focus on the button; a tap toggles it on a touch screen
 * and a tap elsewhere closes it. The card is plain text, never needed to use the page, and is
 * kept inside the screen.
 */
export function InfoPopover({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const touched = useRef(false);
  const [open, setOpen] = useState(false);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    const node = card.current;
    if (node?.matches(":popover-open")) node.hidePopover();
    if (openId === id) {
      openId = null;
      closeOpen = null;
    }
    setOpen(false);
  }, [id]);

  const show = useCallback(() => {
    window.clearTimeout(timer.current);
    const node = card.current;
    const trigger = button.current;
    if (!node || !trigger) return;
    if (closeOpen && openId !== id) closeOpen();
    openId = id;
    closeOpen = hide;
    if (!node.matches(":popover-open")) node.showPopover();
    const box = trigger.getBoundingClientRect();
    const width = Math.min(288, window.innerWidth - 32);
    const left = Math.min(
      Math.max(box.left + box.width / 2 - width / 2, 16),
      window.innerWidth - width - 16,
    );
    node.style.width = `${width}px`;
    node.style.left = `${left}px`;
    node.style.top = `${box.bottom + 6}px`;
    setOpen(true);
  }, [hide, id]);

  const hideSoon = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(hide, CLOSE_DELAY_MS);
  }, [hide]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      hide();
      button.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!card.current?.contains(target) && !button.current?.contains(target)) hide();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, hide]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (openId === id) {
        openId = null;
        closeOpen = null;
      }
    },
    [id],
  );

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onPointerDown={(event) => {
          touched.current = event.pointerType === "touch";
        }}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") show();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") hideSoon();
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) show();
        }}
        onBlur={hide}
        onClick={() => {
          if (touched.current) (open ? hide : show)();
          touched.current = false;
        }}
        className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent md:size-6"
      >
        <Info aria-hidden className="size-4" />
      </button>
      <div
        ref={card}
        id={id}
        role="tooltip"
        popover="manual"
        onPointerEnter={() => window.clearTimeout(timer.current)}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") hideSoon();
        }}
        className="fixed m-0 rounded-panel border border-line bg-panel p-3 text-left text-xs font-normal text-ink shadow-md"
      >
        {children}
      </div>
    </>
  );
}
