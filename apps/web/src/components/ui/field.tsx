import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from "react";

const control =
  "mt-1.5 w-full rounded-panel border border-line bg-panel p-2.75 text-sm text-ink placeholder:text-sub/70 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30 aria-invalid:border-red-600 dark:aria-invalid:border-red-400";

interface FieldShellProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block text-xs text-sub">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-sub">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: unknown) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type Common = { label: string; hint?: ReactNode; error?: string };

export function TextField({
  label,
  hint,
  error,
  ...props
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={control}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...props
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={control}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  ...props
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={control}
        {...props}
      />
    </FieldShell>
  );
}
