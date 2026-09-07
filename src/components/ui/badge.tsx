import * as React from "react";

import type { EstimateStatus, FindingSeverity, ProjectStatus } from "@/lib/domain";
import {
  ESTIMATE_STATUS_LABELS,
  FINDING_SEVERITY_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/domain";
import { cn } from "@/lib/cn";

const TONE = {
  neutral: "bg-steel-100 text-steel-700 border-steel-200",
  info: "bg-info-soft text-info border-blue-200",
  warning: "bg-warning-soft text-warning border-amber-200",
  success: "bg-success-soft text-success border-green-200",
  danger: "bg-danger-soft text-danger border-red-200",
  dark: "bg-steel-800 text-white border-steel-800",
} as const;

export type Tone = keyof typeof TONE;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const ESTIMATE_STATUS_TONE: Record<EstimateStatus, Tone> = {
  DRAFT: "neutral",
  REVIEW: "info",
  SUBMITTED: "dark",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "warning",
};

export function EstimateStatusBadge({ status }: { status: EstimateStatus }) {
  return <Badge tone={ESTIMATE_STATUS_TONE[status]}>{ESTIMATE_STATUS_LABELS[status]}</Badge>;
}

const PROJECT_STATUS_TONE: Record<ProjectStatus, Tone> = {
  planning: "neutral",
  estimating: "info",
  contracted: "success",
  in_progress: "dark",
  completed: "success",
  cancelled: "danger",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={PROJECT_STATUS_TONE[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}

export const SEVERITY_TONE: Record<FindingSeverity, Tone> = {
  danger: "danger",
  warning: "warning",
  info: "info",
  good: "success",
};

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return <Badge tone={SEVERITY_TONE[severity]}>{FINDING_SEVERITY_LABELS[severity]}</Badge>;
}
