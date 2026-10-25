"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";

interface Toast {
  tone: "success" | "error";
  message: string;
}

const ToastContext = createContext<(toast: Toast) => void>(() => {});

/** Announces action results. The live region is always mounted so screen readers hear it. */
export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback((next: Toast) => {
    clearTimeout(timer.current);
    setToast(next);
    timer.current = setTimeout(() => setToast(null), 8000);
  }, []);

  const Icon = toast?.tone === "error" ? CircleAlert : CircleCheck;
  return (
    <ToastContext value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6"
      >
        {toast && (
          <div className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-panel border border-line bg-panel px-4 py-3 text-sm shadow-lg">
            <Icon
              aria-hidden
              className={`mt-0.5 size-4 shrink-0 ${toast.tone === "error" ? "text-red-700 dark:text-red-300" : "text-accent"}`}
            />
            <p className="flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="-m-1 grid size-11 place-items-center md:size-7 rounded-md text-sub hover:bg-soft hover:text-ink"
            >
              <X aria-hidden className="size-4" />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        )}
      </div>
    </ToastContext>
  );
}

export function useAdminToast() {
  return use(ToastContext);
}
