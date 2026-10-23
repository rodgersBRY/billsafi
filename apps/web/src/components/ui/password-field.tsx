"use client";

import { Eye, EyeOff } from "lucide-react";
import { type InputHTMLAttributes, type ReactNode, useId, useState } from "react";
import { controlBase, describedBy, FieldShell } from "./field";

type PasswordFieldProps = { label: string; hint?: ReactNode; error?: string } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

/** Password input with a button that shows or hides what was typed. */
export function PasswordField({ label, hint, error, ...props }: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={`${controlBase} pr-11`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          aria-controls={id}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-panel text-sub hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          {visible ? (
            <EyeOff aria-hidden className="size-4.5" />
          ) : (
            <Eye aria-hidden className="size-4.5" />
          )}
          {/* Text, not aria-label, so tests and screen readers find the input by its own label. */}
          <span className="sr-only">{visible ? "Hide password" : "Show password"}</span>
        </button>
      </div>
    </FieldShell>
  );
}
