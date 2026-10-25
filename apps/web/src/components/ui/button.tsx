"use client";

import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { useHydrated } from "@/lib/use-hydrated";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "border-teal bg-teal text-white hover:bg-teal/90",
  secondary: "border-line bg-panel text-ink hover:bg-soft",
  ghost: "border-transparent bg-transparent text-sub hover:bg-soft hover:text-ink",
  danger: "border-red-700 bg-red-700 text-white hover:bg-red-800",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  pending?: boolean;
}

export function Button({
  variant = "primary",
  pending = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const hydrated = useHydrated();
  return (
    <button
      {...props}
      disabled={disabled || pending || !hydrated}
      aria-busy={pending || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-panel border px-3.75 py-2.75 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
    >
      {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
