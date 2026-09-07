import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { FileText, HardHat, Pencil, Plus } from "lucide-react";

import { EstimateStatusBadge, ProjectStatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList } from "@/components/ui/definition-list";
import { DeleteButton } from "@/components/ui/delete-button";
import { EmptyState } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { WORK_TYPE_LABELS } from "@/lib/domain";
import { formatYen } from "@/lib/money";
import { uuid } from "@/lib/validation/common";
import { requireOrgContext } from "@/server/auth";
import { deleteCustomerAction } from "@/server/actions/customers";
import { getCustomer } from "@/server/queries/customers";
import { listEstimates } from "@/server/queries/estimates";
import { listProjects } from "@/server/queries/projects";

export const metadata: Metadata = { title: "顧客詳細" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsed = uuid.safeParse(id);
  if (!parsed.success) notFound();

  const { organizationId } = await requireOrgContext();
  // Scoped to the caller's organization: another tenant's id renders 404.
  const customer = await getCustomer(organizationId, parsed.data);
  if (!customer) notFound();

  const [projects, estimates] = await Promise.all([
    listProjects(organizationId, { customerId: customer.id }),
    listEstimates(organizationId, { customerId: customer.id }),
  ]);

  return (
    <>
      <PageHeader
        title={customer.name}
        description={customer.company_name || undefined}
        breadcrumb={
          <Link href="/customers" className="underline-offset-2 hover:underline">
            顧客一覧
          </Link>
        }
        actions={
          <>
            <LinkButton href={`/customers/${customer.id}/edit`} variant="secondary">
              <Pencil aria-hidden className="size-4" />
              編集
            </LinkButton>
            <DeleteButton
              action={deleteCustomerAction.bind(null, customer.id)}
              title="この顧客を削除しますか？"
              description={
                <>
                  「{customer.name}」を削除します。この操作は取り消せません。
                  工事案件または見積が紐付いている場合は削除できません。
                </>
              }
              successMessage="顧客を削除しました。"
              redirectTo="/customers"
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="顧客情報" />
          <CardBody>
            <DefinitionList
              items={[
                { label: "顧客名", value: customer.name },
                { label: "法人名", value: customer.company_name },
                { label: "担当者名", value: customer.contact_name },
                { label: "電話番号", value: <span className="tabular">{customer.phone}</span> },
                { label: "メール", value: customer.email },
                { label: "郵便番号", value: customer.postal_code ? `〒${customer.postal_code}` : "" },
                { label: "住所", value: customer.address },
                {
                  label: "登録日",
                  value: new Intl.DateTimeFormat("ja-JP").format(new Date(customer.created_at)),
                },
                {
                  label: "更新日",
                  value: new Intl.DateTimeFormat("ja-JP").format(new Date(customer.updated_at)),
                },
              ]}
            />
            {customer.notes ? (
              <div className="mt-5 border-t border-steel-200 pt-4">
                <p className="text-xs font-medium text-ink-muted">備考</p>
                <p className="mt-1 whitespace-pre-wrap text-[0.95rem] text-ink">{customer.notes}</p>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="工事案件"
              description={`${projects.length} 件`}
              actions={
                <LinkButton href={`/projects/new?customerId=${customer.id}`} size="sm" variant="secondary">
                  <Plus aria-hidden className="size-4" />
                  案件を登録
                </LinkButton>
              }
            />
            <CardBody className="p-0">
              {projects.length === 0 ? (
                <EmptyState
                  icon={HardHat}
                  title="工事案件がありません"
                  description="この顧客の工事案件を登録すると、ここに一覧表示されます。"
                />
              ) : (
                <ul>
                  {projects.map((project) => (
                    <li key={project.id} className="border-b border-steel-100 last:border-b-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex flex-col gap-1 px-5 py-3 hover:bg-steel-50 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{project.name}</p>
                          <p className="text-xs text-ink-muted">
                            {WORK_TYPE_LABELS[project.work_type]}
                            {project.site_address ? `・${project.site_address}` : ""}
                          </p>
                        </div>
                        <ProjectStatusBadge status={project.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="見積" description={`${estimates.length} 件`} />
            <CardBody className="p-0">
              {estimates.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="見積がありません"
                  description="この顧客宛の見積を作成すると、ここに一覧表示されます。"
                  action={
                    <LinkButton href="/estimates/new" size="sm" variant="primary">
                      <Plus aria-hidden className="size-4" />
                      見積を作成
                    </LinkButton>
                  }
                />
              ) : (
                <ul>
                  {estimates.map((estimate) => (
                    <li key={estimate.id} className="border-b border-steel-100 last:border-b-0">
                      <Link
                        href={`/estimates/${estimate.id}`}
                        className="flex flex-col gap-1 px-5 py-3 hover:bg-steel-50 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="tabular text-xs text-ink-muted">
                              {estimate.estimate_number}
                            </span>
                            <EstimateStatusBadge status={estimate.status} />
                          </div>
                          <p className="truncate font-medium text-ink">{estimate.title}</p>
                        </div>
                        <span className="tabular font-semibold text-ink">
                          {formatYen(estimate.total_amount)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
