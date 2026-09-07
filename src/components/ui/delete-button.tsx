"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/server/actions/result";

/**
 * Destructive action guarded by a confirmation dialog. `action` is a server
 * action already bound to the target id, so the browser never chooses what gets
 * deleted from an unvalidated parameter.
 */
export function DeleteButton({
  action,
  label = "削除",
  title,
  description,
  confirmLabel = "削除する",
  successMessage,
  redirectTo,
  size = "md",
}: {
  action: () => Promise<ActionResult>;
  label?: string;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  successMessage: string;
  redirectTo?: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const handleConfirm = async () => {
    setPending(true);
    const result = await action();
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      setOpen(false);
      return;
    }

    toast.success(successMessage);
    setOpen(false);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  };

  return (
    <>
      <Button variant="secondary" size={size} onClick={() => setOpen(true)} className="text-danger">
        <Trash2 aria-hidden className="size-4" />
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        destructive
        loading={pending}
        onConfirm={handleConfirm}
        onCancel={() => {
          if (!pending) setOpen(false);
        }}
      />
    </>
  );
}
