import * as React from "react";

import Link from "next/link";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-amber-accent text-white hover:bg-amber-accent-strong active:bg-amber-accent-strong border border-transparent shadow-sm",
  secondary:
    "bg-white text-steel-800 border border-steel-300 hover:bg-steel-50 active:bg-steel-100",
  subtle: "bg-steel-100 text-steel-800 border border-transparent hover:bg-steel-200",
  ghost: "bg-transparent text-steel-700 border border-transparent hover:bg-steel-100",
  danger: "bg-danger text-white border border-transparent hover:bg-red-800 shadow-sm",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-[0.95rem] gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

const BASE =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/**
 * `type` defaults to "button": a bare <button> inside a form defaults to
 * submit, which is a classic source of accidental submissions.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export interface LinkButtonProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function LinkButton({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </Link>
  );
}
