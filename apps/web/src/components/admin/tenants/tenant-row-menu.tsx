"use client";

import type { AdminAccountStatus } from "@billsafi/contracts";
import { Ban, CircleCheck, Eye, EllipsisVertical } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { type ActionTarget, reactivateAction, suspendAction } from "../account-actions";
import { useConfirmAction } from "../action-host";

interface TenantRowMenuProps {
  target: ActionTarget;
  href: string;
  accountStatus: AdminAccountStatus;
  /** Set when suspending is not allowed, with the reason shown in the menu. */
  blocked: string | null;
}

const item =
  "flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm hover:bg-soft focus-visible:bg-soft focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 md:min-h-9";

/** The per-row overflow menu: View, and Suspend or Reactivate through the table's confirm dialog. */
export function TenantRowMenu({ target, href, accountStatus, blocked }: TenantRowMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const confirm = useConfirmAction();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const suspended = accountStatus === "suspended";
  const action = suspended ? reactivateAction(target) : suspendAction(target);
  const disabled = !suspended && Boolean(blocked);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      const root = menuRef.current?.parentElement;
      if (root && !root.contains(event.target as Node)) setOpen(false);
    };
    // Fixed to the viewport so the table's scroll box can't clip it; close if things move.
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function toggle() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!open && rect) {
      const right = window.innerWidth - rect.right;
      const below = rect.bottom + 180 < window.innerHeight;
      setPosition(
        below
          ? { top: rect.bottom + 4, right }
          : { bottom: window.innerHeight - rect.top + 4, right },
      );
    }
    setOpen((value) => !value);
  }

  function onMenuKeyDown(event: React.KeyboardEvent) {
    const items = [
      ...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? []),
    ];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus({ preventScroll: true });
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
        className="grid size-11 place-items-center rounded-panel text-sub hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:size-9"
      >
        <EllipsisVertical aria-hidden className="size-4" />
        <span className="sr-only">Actions for {target.name}</span>
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Actions for ${target.name}`}
          onKeyDown={onMenuKeyDown}
          style={position}
          className="fixed z-40 w-56 rounded-panel border border-line bg-panel p-1.5 text-left shadow-lg"
        >
          <Link role="menuitem" href={href} className={item} onClick={() => setOpen(false)}>
            <Eye aria-hidden className="size-4 text-sub" />
            View details
          </Link>
          <button
            role="menuitem"
            type="button"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              confirm(action, triggerRef.current);
            }}
            className={`${item} ${suspended ? "" : "text-red-700 dark:text-red-300"}`}
          >
            {suspended ? (
              <CircleCheck aria-hidden className="size-4" />
            ) : (
              <Ban aria-hidden className="size-4" />
            )}
            {suspended ? "Reactivate" : "Suspend"}
          </button>
          {disabled && <p className="px-2.5 pt-1 pb-1.5 text-xs text-sub">{blocked}</p>}
        </div>
      )}
    </div>
  );
}
