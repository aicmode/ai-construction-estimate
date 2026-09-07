"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Bot, Info, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { SeverityBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { FINDING_CATEGORY_LABELS, type FindingSeverity } from "@/lib/domain";
import type { ReviewFinding, ReviewResult } from "@/lib/ai/types";
import { formatPercent, formatYen } from "@/lib/money";
import { runEstimateReviewAction } from "@/server/actions/reviews";
import type { StoredReview } from "@/server/queries/estimates";

const SEVERITY_BORDER: Record<FindingSeverity, string> = {
  danger: "border-l-danger bg-danger-soft/40",
  warning: "border-l-warning bg-warning-soft/40",
  info: "border-l-info bg-info-soft/40",
  good: "border-l-success bg-success-soft/40",
};

function FindingCard({ finding }: { finding: ReviewFinding }) {
  return (
    <li className={`border-l-4 px-4 py-3.5 ${SEVERITY_BORDER[finding.severity]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={finding.severity} />
        <span className="text-xs text-ink-muted">{FINDING_CATEGORY_LABELS[finding.category]}</span>
        <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
          {finding.source === "ai" ? (
            <>
              <Bot aria-hidden className="size-3" />
              AI
            </>
          ) : (
            "ルール"
          )}
        </span>
      </div>
      <p className="mt-1.5 font-medium text-ink">{finding.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{finding.description}</p>
      {finding.recommendedAction ? (
        <p className="mt-2 text-sm text-ink-soft">
          <span className="font-medium text-ink">対応：</span>
          {finding.recommendedAction}
        </p>
      ) : null}
      {finding.itemName ? (
        <p className="mt-1.5 text-xs text-ink-muted">対象明細：{finding.itemName}</p>
      ) : null}
    </li>
  );
}

type PanelReview = Pick<ReviewResult, "summary" | "findings" | "aiError"> & {
  model: string;
  metrics: ReviewResult["metrics"] | null;
  createdAt?: string;
};

export function AiReviewPanel({
  estimateId,
  initialReview,
  aiConfigured,
}: {
  estimateId: string;
  initialReview: StoredReview | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [review, setReview] = React.useState<PanelReview | null>(
    initialReview
      ? {
          summary: initialReview.summary,
          findings: initialReview.findings,
          aiError: initialReview.aiError,
          model: initialReview.model,
          metrics: initialReview.metrics,
          createdAt: initialReview.createdAt,
        }
      : null,
  );

  const run = async () => {
    setPending(true);
    setError(null);
    const result = await runEstimateReviewAction(estimateId);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    setReview({
      summary: result.data.summary,
      findings: result.data.findings,
      aiError: result.data.aiError,
      model: result.data.model,
      metrics: result.data.metrics,
      createdAt: new Date().toISOString(),
    });
    toast.success("見積チェックが完了しました。");
    router.refresh();
  };

  const counts = React.useMemo(() => {
    const initial = { danger: 0, warning: 0, info: 0, good: 0 };
    for (const finding of review?.findings ?? []) initial[finding.severity] += 1;
    return initial;
  }, [review]);

  return (
    <Card>
      <CardHeader
        title="AI見積チェック"
        description={
          aiConfigured
            ? "ルールベース診断とAIレビューを実行します。"
            : "ルールベース診断を実行します（AI機能は未設定）。"
        }
        actions={
          <Button onClick={run} loading={pending}>
            {pending ? (
              <>
                <Loader2 aria-hidden className="size-4 animate-spin" />
                チェックしています…
              </>
            ) : (
              <>
                <Sparkles aria-hidden className="size-4" />
                {review ? "再チェック" : "チェックを実行"}
              </>
            )}
          </Button>
        }
      />

      <CardBody className="p-0">
        {pending ? (
          <div role="status" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Loader2 aria-hidden className="size-6 animate-spin text-amber-accent" />
            <p className="text-sm font-medium text-ink">見積内容を分析しています</p>
            <p className="text-xs text-ink-muted">
              粗利率・単価・明細構成・入力漏れを確認しています。しばらくお待ちください。
            </p>
          </div>
        ) : error ? (
          <div role="alert" className="border-l-4 border-l-danger bg-danger-soft/40 px-4 py-3.5">
            <p className="font-medium text-danger">チェックを実行できませんでした</p>
            <p className="mt-1 text-sm text-red-800">{error}</p>
          </div>
        ) : !review ? (
          <EmptyState
            icon={Sparkles}
            title="まだチェックを実行していません"
            description="粗利率・原価割れ・入力漏れ・明細の偏りなどを自動で確認します。"
          />
        ) : (
          <>
            <div className="border-b border-steel-200 bg-steel-50 px-5 py-4">
              <p className="text-sm leading-relaxed text-ink">{review.summary}</p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-danger-soft px-2.5 py-0.5 font-medium text-danger">
                  危険 {counts.danger}
                </span>
                <span className="rounded-full bg-warning-soft px-2.5 py-0.5 font-medium text-warning">
                  注意 {counts.warning}
                </span>
                <span className="rounded-full bg-info-soft px-2.5 py-0.5 font-medium text-info">
                  確認 {counts.info}
                </span>
                <span className="rounded-full bg-success-soft px-2.5 py-0.5 font-medium text-success">
                  良好 {counts.good}
                </span>
              </div>

              {review.metrics ? (
                <dl className="tabular mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-muted sm:grid-cols-4">
                  <div>
                    <dt className="inline">粗利率 </dt>
                    <dd className="inline font-medium text-ink">
                      {formatPercent(review.metrics.grossMarginRate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">粗利益 </dt>
                    <dd className="inline font-medium text-ink">
                      {formatYen(review.metrics.grossProfit)}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">値引き率 </dt>
                    <dd className="inline font-medium text-ink">
                      {formatPercent(review.metrics.discountRate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">原価未入力 </dt>
                    <dd className="inline font-medium text-ink">
                      {review.metrics.zeroCostItemCount} 件
                    </dd>
                  </div>
                </dl>
              ) : null}

              <p className="mt-3 text-xs text-ink-muted">
                {review.createdAt
                  ? `実行日時 ${new Intl.DateTimeFormat("ja-JP", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(review.createdAt))}`
                  : null}
                {review.model ? `／モデル ${review.model}` : ""}
              </p>
            </div>

            {review.aiError ? (
              <p className="flex items-start gap-2 border-b border-steel-200 bg-warning-soft/50 px-5 py-3 text-sm text-warning">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>{review.aiError}</span>
              </p>
            ) : null}

            {review.findings.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="指摘事項はありません"
                description="ルールベース診断では問題が検出されませんでした。"
              />
            ) : (
              <ul className="divide-y divide-steel-100">
                {review.findings.map((finding, index) => (
                  <FindingCard key={`${finding.id}-${index}`} finding={finding} />
                ))}
              </ul>
            )}

            <p className="border-t border-steel-200 px-5 py-3 text-xs leading-relaxed text-ink-muted">
              本チェックは入力された見積データのみに基づく確認支援です。市場相場との比較は行っていません。
              最終的な金額・条件の判断は担当者が行ってください。
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
