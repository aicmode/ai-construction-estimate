"use client";

import * as React from "react";

import { RefreshCw } from "lucide-react";

import { Button, LinkButton } from "@/components/ui/button";

/**
 * Route-level error boundary. The raw error is intentionally not rendered:
 * server error messages can contain database details, so only the digest that
 * correlates with the server log is shown.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[app]", error.digest ?? error.message);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold text-ink">画面を表示できませんでした</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        データの取得中に問題が発生しました。通信環境を確認して再試行してください。
        繰り返し発生する場合は、時間をおいてからお試しください。
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-ink-muted">エラーID: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Button onClick={reset}>
          <RefreshCw aria-hidden className="size-4" />
          再試行
        </Button>
        <LinkButton href="/dashboard" variant="secondary">
          ダッシュボードへ戻る
        </LinkButton>
      </div>
    </div>
  );
}
