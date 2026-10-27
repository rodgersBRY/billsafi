"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface AdminDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Mobile navigation as a modal sheet from the left. The native dialog traps focus and
 * closes on Escape; the opener puts focus back on the menu button.
 */
export function AdminDrawer({ open, onClose, children }: AdminDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label="Admin navigation"
      onClose={() => {
        if (!ref.current?.open) onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current) onClose();
      }}
      className="m-0 h-dvh max-h-none w-72 border-r border-line bg-panel p-0 text-ink backdrop:bg-black/40 md:hidden"
    >
      <div className="flex h-full flex-col p-4">
        <button
          type="button"
          onClick={onClose}
          className="mb-2 grid size-11 place-items-center self-end rounded-panel text-sub hover:bg-soft hover:text-ink"
        >
          <X aria-hidden className="size-5" />
          <span className="sr-only">Close navigation</span>
        </button>
        {children}
      </div>
    </dialog>
  );
}
