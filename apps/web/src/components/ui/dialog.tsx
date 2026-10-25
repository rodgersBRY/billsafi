"use client";

import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** False while something is in flight: Escape and the close button do nothing. */
  dismissible?: boolean;
  children: React.ReactNode;
}

/** Native modal dialog: focus trapping, Escape and backdrop come from the browser. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  dismissible = true,
  children,
}: DialogProps) {
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
      // A close event can arrive after the dialog was reopened (for example React's
      // development double-mount); only report a close that actually left it closed.
      onClose={() => {
        if (!ref.current?.open) onClose();
      }}
      onCancel={(event) => {
        if (!dismissible) event.preventDefault();
      }}
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
          disabled={!dismissible}
          className="grid size-11 place-items-center rounded-lg text-sub hover:bg-soft hover:text-ink disabled:opacity-50 md:size-8"
        >
          <X aria-hidden className="size-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </dialog>
  );
}
