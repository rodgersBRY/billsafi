"use client";

import { createContext, use, useCallback, useRef, useState } from "react";
import { type ConfirmAction, ConfirmActionDialog } from "./confirm-action-dialog";

type Open = (action: ConfirmAction, returnFocus?: HTMLElement | null) => void;

const ActionContext = createContext<Open>(() => {});

/**
 * One confirm dialog for a whole table and its card list. Rows ask it to open with
 * their action; focus goes back to the button that asked once it closes.
 */
export function ActionHost({ children }: { children: React.ReactNode }) {
  const [action, setAction] = useState<ConfirmAction | null>(null);
  const [open, setOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const openAction = useCallback<Open>((next, from) => {
    returnFocus.current = from ?? null;
    setAction(next);
    setOpen(true);
  }, []);

  return (
    <ActionContext value={openAction}>
      {children}
      {action && (
        <ConfirmActionDialog
          key={action.path}
          action={action}
          open={open}
          onClose={() => {
            setOpen(false);
            // After the native dialog has closed and restored focus to whatever opened it,
            // which may be a menu item that no longer exists.
            setTimeout(() => returnFocus.current?.focus(), 0);
          }}
        />
      )}
    </ActionContext>
  );
}

export function useConfirmAction(): Open {
  return use(ActionContext);
}
