import * as React from "react";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: LucideIcon;
  tone?: "neutral" | "accent" | "success" | "danger";
}) {
  const toneClass = {
    neutral: "bg-steel-100 text-steel-600",
    accent: "bg-amber-accent-soft text-amber-accent-strong",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
  }[tone];

  return (
    <div className="rounded-lg border border-steel-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <span aria-hidden className={cn("flex size-8 items-center justify-center rounded-md", toneClass)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {sub ? <p className="mt-1 text-xs text-ink-muted">{sub}</p> : null}
    </div>
  );
}
