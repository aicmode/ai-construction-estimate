import type { Metadata } from "next";

import Link from "next/link";

import { FileText, Plus, Search } from "lucide-react";

import { EstimateStatusBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ESTIMATE_STATUSES, ESTIMATE_STATUS_LABELS } from "@/lib/domain";
import { formatPercent, formatYen } from "@/lib/money";
import { estimateListFilterSchema } from "@/lib/validation/estimate";
import { requireOrgContext } from "@/server/auth";
import { listCustomerOptions } from "@/server/queries/customers";
import { listEstimates } from "@/server/queries/estimates";

export const metadata: Metadata = { title: "見積" };

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("ja-JP").format(new Date(value)) : "—";
}

const INPUT_CLASS =
  "h-11 w-full rounded-md border border-steel-300 bg-white px-3 text-[0.95rem] placeholder:text-steel-400 hover:border-steel-400 focus:border-amber-accent";

export default async function EstimatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // Unknown or malformed query parameters are dropped rather than passed to the
  // database layer.
  const parsed = estimateListFilterSchema.safeParse(raw);
  const filter = parsed.success ? parsed.data : {};

  const { organizationId } = await requireOrgContext();
  const [estimates, customers] = await Promise.all([
    listEstimates(organizationId, filter),
    listCustomerOptions(organizationId),
  ]);

  const hasFilter = Object.values(filter).some(Boolean);

  return (
    <>
      <PageHeader
        title="見積"
        description="見積の作成・提出状況と採算を一覧で確認できます。"
        actions={
          <LinkButton href="/estimates/new" variant="primary">
            <Plus aria-hidden className="size-4" />
            見積を作成
          </LinkButton>
        }
      />

      <Card>
        <CardBody className="border-b border-steel-200">
          <form method="get" role="search" className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-steel-400"
              />
              <label htmlFor="q" className="sr-only">
                見積番号・タイトル・備考で検索
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={filter.q ?? ""}
                placeholder="見積番号・タイトル・備考で検索"
                className={`${INPUT_CLASS} pl-9`}
              />
            </div>

            <div>
              <label htmlFor="customerId" className="sr-only">
                顧客
              </label>
              <select id="customerId" name="customerId" defaultValue={filter.customerId ?? ""} className={INPUT_CLASS}>
                <option value="">全顧客</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="status" className="sr-only">
                ステータス
              </label>
              <select id="status" name="status" defaultValue={filter.status ?? ""} className={INPUT_CLASS}>
                <option value="">全ステータス</option>
                {ESTIMATE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {ESTIMATE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="from" className="sr-only">
                  発行日（開始）
                </label>
                <input id="from" name="from" type="date" defaultValue={filter.from ?? ""} className={INPUT_CLASS} />
              </div>
              <div>
                <label htmlFor="to" className="sr-only">
                  発行日（終了）
                </label>
                <input id="to" name="to" type="date" defaultValue={filter.to ?? ""} className={INPUT_CLASS} />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="h-11 flex-1 rounded-md border border-steel-300 bg-white px-5 font-medium text-steel-800 hover:bg-steel-50 xl:flex-none"
              >
                絞り込む
              </button>
              {hasFilter ? (
                <Link
                  href="/estimates"
                  className="flex h-11 items-center rounded-md px-3 text-sm text-ink-muted underline-offset-2 hover:underline"
                >
                  クリア
                </Link>
              ) : null}
            </div>
          </form>
        </CardBody>

        <CardBody className="p-0">
          {estimates.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={hasFilter ? "条件に一致する見積がありません" : "見積がまだありません"}
              description={
                hasFilter
                  ? "検索条件を変更してもう一度お試しください。"
                  : "顧客と工事案件を登録したあと、最初の見積を作成しましょう。"
              }
              action={
                hasFilter ? (
                  <LinkButton href="/estimates" size="sm" variant="secondary">
                    条件をクリア
                  </LinkButton>
                ) : (
                  <LinkButton href="/estimates/new" size="sm" variant="primary">
                    <Plus aria-hidden className="size-4" />
                    見積を作成
                  </LinkButton>
                )
              }
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-steel-200 bg-steel-50 text-xs text-ink-muted">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">見積番号 / 件名</th>
                      <th scope="col" className="px-5 py-3 font-medium">顧客 / 案件</th>
                      <th scope="col" className="px-5 py-3 font-medium">発行日</th>
                      <th scope="col" className="px-5 py-3 font-medium">有効期限</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">合計（税込）</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">粗利率</th>
                      <th scope="col" className="px-5 py-3 font-medium">ステータス</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimates.map((estimate) => (
                      <tr key={estimate.id} className="border-b border-steel-100 last:border-b-0 hover:bg-steel-50">
                        <td className="px-5 py-3">
                          <span className="tabular block text-xs text-ink-muted">{estimate.estimate_number}</span>
                          <Link
                            href={`/estimates/${estimate.id}`}
                            className="font-medium text-ink underline-offset-2 hover:underline"
                          >
                            {estimate.title}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-ink-soft">
                          <span className="block">{estimate.customerName}</span>
                          {estimate.projectName ? (
                            <span className="block text-xs text-ink-muted">{estimate.projectName}</span>
                          ) : null}
                        </td>
                        <td className="tabular px-5 py-3 text-ink-soft">{formatDate(estimate.issue_date)}</td>
                        <td className="tabular px-5 py-3 text-ink-soft">{formatDate(estimate.valid_until)}</td>
                        <td className="tabular px-5 py-3 text-right font-semibold text-ink">
                          {formatYen(estimate.total_amount)}
                        </td>
                        <td
                          className={
                            estimate.gross_margin_rate < 0.1
                              ? "tabular px-5 py-3 text-right font-semibold text-danger"
                              : "tabular px-5 py-3 text-right text-ink-soft"
                          }
                        >
                          {formatPercent(estimate.gross_margin_rate)}
                        </td>
                        <td className="px-5 py-3">
                          <EstimateStatusBadge status={estimate.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="lg:hidden">
                {estimates.map((estimate) => (
                  <li key={estimate.id} className="border-b border-steel-100 last:border-b-0">
                    <Link href={`/estimates/${estimate.id}`} className="block px-4 py-3.5 hover:bg-steel-50">
                      <div className="flex items-start justify-between gap-3">
                        <span className="tabular text-xs text-ink-muted">{estimate.estimate_number}</span>
                        <EstimateStatusBadge status={estimate.status} />
                      </div>
                      <p className="mt-0.5 font-medium text-ink">{estimate.title}</p>
                      <p className="text-sm text-ink-soft">{estimate.customerName}</p>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <p className="tabular text-xs text-ink-muted">
                          発行 {formatDate(estimate.issue_date)}／期限 {formatDate(estimate.valid_until)}
                        </p>
                        <div className="text-right">
                          <p className="tabular font-semibold text-ink">{formatYen(estimate.total_amount)}</p>
                          <p
                            className={
                              estimate.gross_margin_rate < 0.1
                                ? "tabular text-xs font-semibold text-danger"
                                : "tabular text-xs text-ink-muted"
                            }
                          >
                            粗利率 {formatPercent(estimate.gross_margin_rate)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}
