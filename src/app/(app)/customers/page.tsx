import type { Metadata } from "next";

import Link from "next/link";

import { Plus, Search, Users } from "lucide-react";

import { LinkButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrgContext } from "@/server/auth";
import { listCustomers } from "@/server/queries/customers";

export const metadata: Metadata = { title: "顧客" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { organizationId, isReadOnly } = await requireOrgContext();
  const customers = await listCustomers(organizationId, { q });

  return (
    <>
      <PageHeader
        title="顧客"
        description="工事案件と見積の発行先を管理します。"
        actions={
          isReadOnly ? null : (
            <LinkButton href="/customers/new" variant="primary">
              <Plus aria-hidden className="size-4" />
              顧客を登録
            </LinkButton>
          )
        }
      />

      <Card>
        <CardBody className="border-b border-steel-200">
          <form method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-steel-400"
              />
              <label htmlFor="q" className="sr-only">
                顧客名・法人名・担当者・住所で検索
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={q ?? ""}
                placeholder="顧客名・法人名・担当者・住所で検索"
                className="h-11 w-full rounded-md border border-steel-300 bg-white pr-3 pl-9 text-[0.95rem] placeholder:text-steel-400 hover:border-steel-400 focus:border-amber-accent"
              />
            </div>
            <button
              type="submit"
              className="h-11 rounded-md border border-steel-300 bg-white px-5 font-medium text-steel-800 hover:bg-steel-50"
            >
              検索
            </button>
          </form>
        </CardBody>

        <CardBody className="p-0">
          {customers.length === 0 ? (
            <EmptyState
              icon={Users}
              title={q ? "該当する顧客が見つかりません" : "顧客がまだ登録されていません"}
              description={
                q
                  ? "検索条件を変更してもう一度お試しください。"
                  : isReadOnly
                    ? "このデモ環境には表示できる顧客がありません。"
                    : "顧客を登録すると、工事案件と見積を紐付けられます。"
              }
              action={
                q ? (
                  <LinkButton href="/customers" size="sm" variant="secondary">
                    検索条件をクリア
                  </LinkButton>
                ) : isReadOnly ? null : (
                  <LinkButton href="/customers/new" size="sm" variant="primary">
                    <Plus aria-hidden className="size-4" />
                    顧客を登録
                  </LinkButton>
                )
              }
            />
          ) : (
            <>
              {/* Desktop: a real table. */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-steel-200 bg-steel-50 text-xs text-ink-muted">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">顧客名</th>
                      <th scope="col" className="px-5 py-3 font-medium">担当者</th>
                      <th scope="col" className="px-5 py-3 font-medium">連絡先</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">案件</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">見積</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer.id} className="border-b border-steel-100 last:border-b-0 hover:bg-steel-50">
                        <td className="px-5 py-3">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="font-medium text-ink underline-offset-2 hover:underline"
                          >
                            {customer.name}
                          </Link>
                          {customer.company_name ? (
                            <p className="text-xs text-ink-muted">{customer.company_name}</p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 text-ink-soft">{customer.contact_name || "—"}</td>
                        <td className="px-5 py-3 text-ink-soft">
                          <span className="tabular block">{customer.phone || "—"}</span>
                          {customer.email ? (
                            <span className="block text-xs text-ink-muted">{customer.email}</span>
                          ) : null}
                        </td>
                        <td className="tabular px-5 py-3 text-right text-ink-soft">
                          {customer.projectCount}
                        </td>
                        <td className="tabular px-5 py-3 text-right text-ink-soft">
                          {customer.estimateCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: stacked cards instead of a horizontally scrolling table. */}
              <ul className="md:hidden">
                {customers.map((customer) => (
                  <li key={customer.id} className="border-b border-steel-100 last:border-b-0">
                    <Link href={`/customers/${customer.id}`} className="block px-4 py-3.5 hover:bg-steel-50">
                      <p className="font-medium text-ink">{customer.name}</p>
                      {customer.company_name ? (
                        <p className="text-xs text-ink-muted">{customer.company_name}</p>
                      ) : null}
                      <p className="tabular mt-1 text-sm text-ink-soft">{customer.phone || "電話番号未登録"}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        案件 {customer.projectCount} 件・見積 {customer.estimateCount} 件
                      </p>
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
