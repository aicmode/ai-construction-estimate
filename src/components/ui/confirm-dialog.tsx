"use client";

import * as React from "react";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Built on the native <dialog> element so focus trapping, Escape handling and
 * the top layer come from the platform rather than from hand-rolled JS.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "実行する",
  cancelLabel = "キャンセル",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!loading) onCancel();
      }}
      onClose={() => {
        if (open && !loading) onCancel();
      }}
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-lg border border-steel-200 bg-white p-0 shadow-xl backdrop:bg-steel-950/50"
    >
      <div className="flex gap-3 p-5">
        <span
          aria-hidden
          className={
            destructive
              ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
              : "flex size-9 shrink-0 items-center justify-center rounded-full bg-steel-100 text-steel-700"
          }
        >
          <AlertTriangle className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="confirm-dialog-title" className="text-base font-semibold text-ink">
            {title}
          </h2>
          <div className="mt-1.5 text-sm text-ink-soft">{description}</div>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-steel-200 bg-steel-50 px-5 py-3">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
