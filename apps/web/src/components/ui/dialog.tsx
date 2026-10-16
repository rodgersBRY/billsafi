"use client";

import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

/** Native modal dialog: focus trapping, Escape and backdrop come from the browser. */
export function Dialog({ open, onClose, title, description, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Next.js keeps visited pages alive; never come back to an open dialog.
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-panel border border-line bg-panel p-0 text-ink backdrop:bg-black/40"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-sub">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-sub hover:bg-soft hover:text-ink"
        >
          <X aria-hidden className="size-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </dialog>
  );
}
