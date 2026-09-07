import * as React from "react";

import { HardHat } from "lucide-react";

/** Shared frame for the login / signup / onboarding screens. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col justify-center bg-steel-950 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-md bg-amber-accent text-white"
          >
            <HardHat className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide text-white">
              AI工事・リフォーム見積管理
            </p>
            <p className="text-xs text-steel-400">Construction Estimate Suite</p>
          </div>
        </div>

        <div className="rounded-lg border border-steel-200 bg-white p-6 shadow-xl sm:p-7">
          <h1 className="text-lg font-semibold text-ink">{title}</h1>
          {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
          <div className="mt-5">{children}</div>
        </div>

        {footer ? <div className="mt-5 text-center text-sm text-steel-400">{footer}</div> : null}
      </div>
    </main>
  );
}
