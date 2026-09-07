import * as React from "react";

import { AlertTriangle, Loader2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-14 text-center", className)}>
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-steel-100 text-steel-500"
      >
        <Icon className="size-6" />
      </span>
      <div>
        <p className="font-medium text-ink">{title}</p>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "データを取得できませんでした",
  description,
  action,
}: {
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-danger-soft px-6 py-10 text-center"
    >
      <AlertTriangle aria-hidden className="size-6 text-danger" />
      <div>
        <p className="font-medium text-danger">{title}</p>
        {description ? <p className="mt-1 text-sm text-red-800">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ label = "読み込み中", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-ink-muted", className)}>
      <Loader2 aria-hidden className="size-4 animate-spin" />
      <span>{label}</span>
    </span>
  );
}

export function LoadingBlock({ label = "読み込み中" }: { label?: string }) {
  return (
    <div role="status" className="flex justify-center px-6 py-14">
      <Spinner label={label} />
    </div>
  );
}

/** Grey placeholder used by route-level `loading.tsx` files. */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="読み込み中" className="flex flex-col gap-2 p-5">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-11 animate-pulse rounded bg-steel-100" />
      ))}
    </div>
  );
}
