import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { Pencil } from "lucide-react";

import { EstimateStatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList } from "@/components/ui/definition-list";
import { DeleteButton } from "@/components/ui/delete-button";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { AiReviewPanel } from "@/components/estimates/ai-review-panel";
import {
  DuplicateButton,
  PdfButton,
  StatusChanger,
} from "@/components/estimates/estimate-actions";
import { ITEM_CATEGORY_LABELS, UNIT_LABELS, WORK_TYPE_LABELS, type WorkType } from "@/lib/domain";
import { isAiConfigured } from "@/lib/env";
import { formatPercent, formatQuantity, formatYen } from "@/lib/money";
import { uuid } from "@/lib/validation/common";
import { requireOrgContext } from "@/server/auth";
import { deleteEstimateAction } from "@/server/actions/estimates";
import { getEstimateDetail, getLatestReview } from "@/server/queries/estimates";

export const metadata: Metadata = { title: "見積詳細" };

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("ja-JP").format(new Date(value)) : "";
}

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsed = uuid.safeParse(id);
  if (!parsed.success) notFound();

  const { organizationId } = await requireOrgContext();
  const estimate = await getEstimateDetail(organizationId, parsed.data);
  if (!estimate) notFound();

  const latestReview = await getLatestReview(organizationId, estimate.id);
  const aiConfigured = isAiConfigured();

  return (
    <>
      <PageHeader
        title={estimate.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="tabular">{estimate.estimate_number}</span>
            <EstimateStatusBadge status={estimate.status} />
          </span>
        }
        breadcrumb={
          <Link href="/estimates" className="underline-offset-2 hover:underline">
            見積一覧
          </Link>
        }
        actions={
          <>
            <LinkButton href={`/estimates/${estimate.id}/edit`} variant="secondary">
              <Pencil aria-hidden className="size-4" />
              編集
            </LinkButton>
            <DuplicateButton estimateId={estimate.id} />
            <DeleteButton
              action={deleteEstimateAction.bind(null, estimate.id)}
              title="この見積を削除しますか？"
              description={
                <>
                  「{estimate.title}（{estimate.estimate_number}）」を削除します。
                  一覧・集計から除外されます（データは論理削除として保持されます）。
                </>
              }
              successMessage="見積を削除しました。"
              redirectTo="/estimates"
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="見積情報" />
            <CardBody>
              <DefinitionList
                items={[
                  {
                    label: "顧客",
                    value: (
                      <Link
                        href={`/customers/${estimate.customer.id}`}
                        className="text-ink underline underline-offset-2"
                      >
                        {estimate.customer.companyName || estimate.customer.name}
                      </Link>
                    ),
                  },
                  {
                    label: "工事案件",
                    value: estimate.project ? (
                      <Link
                        href={`/projects/${estimate.project.id}`}
                        className="text-ink underline underline-offset-2"
                      >
                        {estimate.project.name}
                      </Link>
                    ) : (
                      "紐付けなし"
                    ),
                  },
                  { label: "発行日", value: formatDate(estimate.issue_date) },
                  { label: "有効期限", value: formatDate(estimate.valid_until) },
                  {
                    label: "工事種別",
                    value: estimate.project
                      ? WORK_TYPE_LABELS[estimate.project.workType as WorkType]
                      : "",
                  },
                  { label: "施工場所", value: estimate.project?.siteAddress || estimate.customer.address },
                  { label: "支払条件", value: estimate.payment_terms },
                  { label: "消費税率", value: `${estimate.tax_rate}%` },
                ]}
              />
              {estimate.notes ? (
                <div className="mt-5 border-t border-steel-200 pt-4">
                  <p className="text-xs font-medium text-ink-muted">備考</p>
                  <p className="mt-1 whitespace-pre-wrap text-[0.95rem] text-ink">{estimate.notes}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="見積明細" description={`${estimate.items.length} 行`} />
            <CardBody className="p-0">
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-steel-200 bg-steel-50 text-xs text-ink-muted">
                    <tr>
                      <th scope="col" className="w-10 px-4 py-3 text-right font-medium">No</th>
                      <th scope="col" className="px-4 py-3 font-medium">工事項目・摘要</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium whitespace-nowrap">数量</th>
                      <th scope="col" className="px-4 py-3 font-medium whitespace-nowrap">単位</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium whitespace-nowrap">販売単価</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium whitespace-nowrap">金額</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium whitespace-nowrap">原価</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium whitespace-nowrap">粗利</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.items.map((item, index) => {
                      const profit = item.amount - item.cost_amount;
                      return (
                        <tr key={item.id} className="border-b border-steel-100 last:border-b-0">
                          <td className="tabular px-4 py-3 text-right text-ink-muted">{index + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-ink">{item.name}</p>
                            <p className="text-xs text-ink-muted">
                              {ITEM_CATEGORY_LABELS[item.category]}
                              {item.description ? ` ／ ${item.description}` : ""}
                            </p>
                          </td>
                          <td className="tabular px-4 py-3 text-right whitespace-nowrap text-ink-soft">
                            {formatQuantity(item.quantity)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{UNIT_LABELS[item.unit]}</td>
                          <td className="tabular px-4 py-3 text-right whitespace-nowrap text-ink-soft">
                            {formatYen(item.unit_price)}
                          </td>
                          <td className="tabular px-4 py-3 text-right whitespace-nowrap font-medium text-ink">
                            {formatYen(item.amount)}
                          </td>
                          <td className="tabular px-4 py-3 text-right whitespace-nowrap text-ink-muted">
                            {formatYen(item.cost_amount)}
                          </td>
                          <td
                            className={
                              profit < 0
                                ? "tabular px-4 py-3 text-right whitespace-nowrap font-semibold text-danger"
                                : "tabular px-4 py-3 text-right whitespace-nowrap text-ink-soft"
                            }
                          >
                            {formatYen(profit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: one card per line item — no horizontal scrolling. */}
              <ul className="lg:hidden">
                {estimate.items.map((item, index) => {
                  const profit = item.amount - item.cost_amount;
                  return (
                    <li key={item.id} className="border-b border-steel-100 px-4 py-3.5 last:border-b-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 font-medium text-ink">
                          <span className="tabular mr-1.5 text-xs text-ink-muted">{index + 1}.</span>
                          {item.name}
                        </p>
                        <span className="tabular shrink-0 font-semibold text-ink">
                          {formatYen(item.amount)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {ITEM_CATEGORY_LABELS[item.category]}
                        {item.description ? ` ／ ${item.description}` : ""}
                      </p>
                      <dl className="tabular mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-soft">
                        <div className="flex justify-between">
                          <dt className="text-ink-muted">数量</dt>
                          <dd>
                            {formatQuantity(item.quantity)} {UNIT_LABELS[item.unit]}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-ink-muted">単価</dt>
                          <dd>{formatYen(item.unit_price)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-ink-muted">原価</dt>
                          <dd>{formatYen(item.cost_amount)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-ink-muted">粗利</dt>
                          <dd className={profit < 0 ? "font-semibold text-danger" : ""}>
                            {formatYen(profit)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>

          <AiReviewPanel
            estimateId={estimate.id}
            initialReview={latestReview}
            aiConfigured={aiConfigured}
          />
        </div>

        <aside className="flex flex-col gap-6 xl:sticky xl:top-6 xl:h-fit">
          <Card>
            <CardHeader title="金額" />
            <CardBody>
              <dl className="flex flex-col gap-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">明細合計</dt>
                  <dd className="tabular font-medium text-ink">{formatYen(estimate.items_subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">値引き</dt>
                  <dd className="tabular font-medium text-ink">
                    {estimate.discount_amount > 0 ? `-${formatYen(estimate.discount_amount)}` : formatYen(0)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-steel-200 pt-2.5">
                  <dt className="text-ink-muted">税抜合計</dt>
                  <dd className="tabular font-medium text-ink">{formatYen(estimate.subtotal_amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">消費税（{estimate.tax_rate}%）</dt>
                  <dd className="tabular font-medium text-ink">{formatYen(estimate.tax_amount)}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t-2 border-steel-800 pt-3">
                  <dt className="font-semibold text-ink">合計（税込）</dt>
                  <dd className="tabular text-xl font-bold text-ink">{formatYen(estimate.total_amount)}</dd>
                </div>
                <div className="mt-2 rounded-md bg-steel-50 p-3">
                  <div className="flex justify-between text-sm">
                    <dt className="text-ink-muted">原価合計</dt>
                    <dd className="tabular font-medium text-ink">{formatYen(estimate.cost_amount)}</dd>
                  </div>
                  <div className="mt-1.5 flex justify-between text-sm">
                    <dt className="text-ink-muted">粗利益</dt>
                    <dd
                      className={
                        estimate.gross_profit < 0
                          ? "tabular font-semibold text-danger"
                          : "tabular font-semibold text-ink"
                      }
                    >
                      {formatYen(estimate.gross_profit)}
                    </dd>
                  </div>
                  <div className="mt-1.5 flex justify-between text-sm">
                    <dt className="text-ink-muted">粗利率</dt>
                    <dd
                      className={
                        estimate.gross_margin_rate < 0.1
                          ? "tabular font-semibold text-danger"
                          : "tabular font-semibold text-success"
                      }
                    >
                      {formatPercent(estimate.gross_margin_rate)}
                    </dd>
                  </div>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="操作" />
            <CardBody className="flex flex-col gap-4">
              <StatusChanger estimateId={estimate.id} currentStatus={estimate.status} />
              <div className="border-t border-steel-200 pt-4">
                <p className="mb-2 text-xs font-medium text-ink-muted">見積書</p>
                <PdfButton estimateId={estimate.id} estimateNumber={estimate.estimate_number} />
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
