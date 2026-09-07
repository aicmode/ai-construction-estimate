"use client";

import * as React from "react";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const TONE_STYLE: Record<ToastTone, { className: string; Icon: typeof Info }> = {
  success: { className: "border-green-300 bg-success-soft text-success", Icon: CheckCircle2 },
  error: { className: "border-red-300 bg-danger-soft text-danger", Icon: AlertTriangle },
  info: { className: "border-steel-300 bg-white text-steel-800", Icon: Info },
};

const AUTO_DISMISS_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const nextId = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = (nextId.current += 1);
      setToasts((current) => [...current, { id, tone, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message: string) => toast(message, "success"),
      error: (message: string) => toast(message, "error"),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        `role="status"` + `aria-live="polite"` announces the result of an action
        to screen reader users without stealing focus.
      */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map(({ id, tone, message }) => {
          const { className, Icon } = TONE_STYLE[tone];
          return (
            <div
              key={id}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-md border px-4 py-3 text-sm shadow-lg",
                className,
              )}
            >
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 flex-1 break-words">{message}</span>
              <button
                type="button"
                onClick={() => dismiss(id)}
                className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
                aria-label="通知を閉じる"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
