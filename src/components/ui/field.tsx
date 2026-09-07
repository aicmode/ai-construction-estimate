"use client";

import * as React from "react";

import { cn } from "@/lib/cn";

const CONTROL_BASE =
  "w-full rounded-md border bg-white px-3 text-[0.95rem] text-ink transition-colors " +
  "placeholder:text-steel-400 disabled:cursor-not-allowed disabled:bg-steel-50 disabled:text-ink-muted";

const CONTROL_STATE = (invalid?: boolean) =>
  invalid
    ? "border-danger focus:border-danger"
    : "border-steel-300 hover:border-steel-400 focus:border-amber-accent";

export interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps a control with its label, hint and error message and wires up the
 * `aria-describedby` / `aria-invalid` relationships that screen readers need.
 * `describedBy` returns the ids a control must reference.
 */
export function Field({ id, label, required, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-steel-700">
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-label="必須">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, hint?: unknown, error?: unknown): string | undefined {
  const ids = [error ? `${id}-error` : null, !error && hint ? `${id}-hint` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export const TextInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function TextInput({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(CONTROL_BASE, CONTROL_STATE(invalid), "h-11", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(CONTROL_BASE, CONTROL_STATE(invalid), "resize-y py-2.5 leading-relaxed", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(CONTROL_BASE, CONTROL_STATE(invalid), "h-11 pr-8", className)}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
});
