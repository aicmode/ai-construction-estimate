import type { Metadata } from "next";

import Link from "next/link";

import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Percent,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { EstimateStatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { ESTIMATE_STATUSES, ESTIMATE_STATUS_LABELS } from "@/lib/domain";
import { formatPercent, formatYen } from "@/lib/money";
import { requireOrgContext } from "@/server/auth";
import { getDashboardData, type RecentEstimate } from "@/server/queries/dashboard";

export const metadata: Metadata = { title: "ダッシュボード" };

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function EstimateRow({ estimate, showMargin = true }: { estimate: RecentEstimate; showMargin?: boolean }) {
  return (
    <li>
      <Link
        href={`/estimates/${estimate.id}`}
        className="flex flex-col gap-1.5 border-b border-steel-100 px-5 py-3 transition-colors last:border-b-0 hover:bg-steel-50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular text-xs text-ink-muted">{estimate.estimateNumber}</span>
            <EstimateStatusBadge status={estimate.status} />
          </div>
          <p className="mt-0.5 truncate font-medium text-ink">{estimate.title}</p>
          <p className="truncate text-xs text-ink-muted">{estimate.customerName}</p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="tabular font-semibold text-ink">{formatYen(estimate.totalAmount)}</p>
          <p className="tabular text-xs text-ink-muted">
            {showMargin ? `粗利率 ${formatPercent(estimate.grossMarginRate)}・` : ""}
            {formatDateTime(estimate.updatedAt)}
          </p>
        </div>
      </Link>
    </li>
  );
}

export default async function DashboardPage() {
  const { organizationId, organizationName, isReadOnly } = await requireOrgContext();
  const data = await getDashboardData(organizationId);

  const statusTotal = ESTIMATE_STATUSES.reduce(
    (sum, status) => sum + data.statusCounts[status],
    0,
  );

  return (
    <>
      <PageHeader
        title="ダッシュボード"
        description={`${organizationName} の見積状況（${data.monthLabel}時点）`}
        actions={
          isReadOnly ? null : (
            <LinkButton href="/estimates/new" variant="primary">
              <Plus aria-hidden className="size-4" />
              見積を作成
            </LinkButton>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={`${data.monthLabel}の見積作成`}
          value={`${data.monthlyCount} 件`}
          sub={`見積総額 ${formatYen(data.monthlyTotal)}（税込）`}
          icon={FileText}
        />
        <StatCard
          label="受注見込額"
          value={formatYen(data.pipelineAmount)}
          sub={`確認中・提出済み ${data.pipelineCount} 件`}
          icon={TrendingUp}
          tone="accent"
        />
        <StatCard
          label={`受注金額（${new Date().getFullYear()}年）`}
          value={formatYen(data.acceptedYearAmount)}
          sub={`受注 ${data.acceptedYearCount} 件`}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="平均粗利率"
          value={formatPercent(data.averageMarginRate)}
          sub="失注を除く見積の加重平均（税抜ベース）"
          icon={Percent}
        />
        <StatCard
          label="要注意の見積"
          value={`${data.attentionCount} 件`}
          sub="粗利率10%未満・期限切れ・期限が7日以内"
          icon={AlertTriangle}
          tone={data.attentionCount > 0 ? "danger" : "neutral"}
        />
        <StatCard
          label="登録済み見積"
          value={`${statusTotal} 件`}
          sub="削除済みを除く全件"
          icon={Wallet}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="見積金額の推移" description="直近6ヶ月・発行日ベース（税込）" />
          <CardBody>
            <TrendChart data={data.trend} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="ステータス別件数" />
          <CardBody className="p-0">
            <ul>
              {ESTIMATE_STATUSES.map((status) => {
                const count = data.statusCounts[status];
                const share = statusTotal > 0 ? Math.round((count / statusTotal) * 100) : 0;
                return (
                  <li
                    key={status}
                    className="flex items-center gap-3 border-b border-steel-100 px-5 py-2.5 last:border-b-0"
                  >
                    <span className="w-20 shrink-0 text-sm text-ink-soft">
                      {ESTIMATE_STATUS_LABELS[status]}
                    </span>
                    <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-steel-100">
                      <span
                        className="block h-full rounded-full bg-steel-500"
                        style={{ width: `${share}%` }}
                      />
                    </span>
                    <span className="tabular w-12 shrink-0 text-right text-sm font-medium text-ink">
                      {count} 件
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="最近更新した見積"
            actions={
              <LinkButton href="/estimates" size="sm" variant="ghost">
                すべて見る
              </LinkButton>
            }
          />
          <CardBody className="p-0">
            {data.recent.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="見積がまだありません"
                description="最初の見積を作成すると、ここに表示されます。"
                action={
                  isReadOnly ? null : (
                    <LinkButton href="/estimates/new" variant="primary" size="sm">
                      <Plus aria-hidden className="size-4" />
                      見積を作成
                    </LinkButton>
                  )
                }
              />
            ) : (
              <ul>
                {data.recent.map((estimate) => (
                  <EstimateRow key={estimate.id} estimate={estimate} />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="要注意の見積"
            description="粗利率が低い、または有効期限が迫っている見積"
          />
          <CardBody className="p-0">
            {data.attentionEstimates.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="要注意の見積はありません"
                description="粗利率・有効期限ともに問題は検出されていません。"
              />
            ) : (
              <ul>
                {data.attentionEstimates.map((estimate) => (
                  <EstimateRow key={estimate.id} estimate={estimate} />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
