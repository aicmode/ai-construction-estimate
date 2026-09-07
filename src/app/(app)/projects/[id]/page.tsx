import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { FileText, Pencil, Plus } from "lucide-react";

import { EstimateStatusBadge, ProjectStatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList } from "@/components/ui/definition-list";
import { DeleteButton } from "@/components/ui/delete-button";
import { EmptyState } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { WORK_TYPE_LABELS } from "@/lib/domain";
import { formatPercent, formatYen } from "@/lib/money";
import { uuid } from "@/lib/validation/common";
import { requireOrgContext } from "@/server/auth";
import { deleteProjectAction } from "@/server/actions/projects";
import { listEstimates } from "@/server/queries/estimates";
import { getProject } from "@/server/queries/projects";

export const metadata: Metadata = { title: "工事案件詳細" };

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("ja-JP").format(new Date(value)) : "";
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsed = uuid.safeParse(id);
  if (!parsed.success) notFound();

  const { organizationId, isReadOnly } = await requireOrgContext();
  const project = await getProject(organizationId, parsed.data);
  if (!project) notFound();

  const estimates = (await listEstimates(organizationId)).filter(
    (estimate) => estimate.project_id === project.id,
  );

  return (
    <>
      <PageHeader
        title={project.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <span>{WORK_TYPE_LABELS[project.work_type]}</span>
          </span>
        }
        breadcrumb={
          <Link href="/projects" className="underline-offset-2 hover:underline">
            工事案件一覧
          </Link>
        }
        actions={
          isReadOnly ? null : (
            <>
              <LinkButton href={`/estimates/new?projectId=${project.id}`} variant="primary">
                <Plus aria-hidden className="size-4" />
                この案件で見積作成
              </LinkButton>
              <LinkButton href={`/projects/${project.id}/edit`} variant="secondary">
                <Pencil aria-hidden className="size-4" />
                編集
              </LinkButton>
              <DeleteButton
                action={deleteProjectAction.bind(null, project.id)}
                title="この工事案件を削除しますか？"
                description={
                  <>
                    「{project.name}」を削除します。この操作は取り消せません。
                    紐付いている見積の案件情報は空欄になります。
                  </>
                }
                successMessage="工事案件を削除しました。"
                redirectTo="/projects"
              />
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="案件情報" />
          <CardBody>
            <DefinitionList
              items={[
                {
                  label: "顧客",
                  value: (
                    <Link
                      href={`/customers/${project.customer_id}`}
                      className="text-ink underline underline-offset-2"
                    >
                      {project.customerName}
                    </Link>
                  ),
                },
                { label: "工事種別", value: WORK_TYPE_LABELS[project.work_type] },
                { label: "施工場所", value: project.site_address },
                { label: "担当者", value: project.manager_name },
                { label: "着工予定日", value: formatDate(project.scheduled_start_date) },
                { label: "完了予定日", value: formatDate(project.scheduled_end_date) },
              ]}
            />
            {project.description ? (
              <div className="mt-5 border-t border-steel-200 pt-4">
                <p className="text-xs font-medium text-ink-muted">工事概要</p>
                <p className="mt-1 whitespace-pre-wrap text-[0.95rem] text-ink">{project.description}</p>
              </div>
            ) : null}
            {project.notes ? (
              <div className="mt-4">
                <p className="text-xs font-medium text-ink-muted">備考</p>
                <p className="mt-1 whitespace-pre-wrap text-[0.95rem] text-ink">{project.notes}</p>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="この案件の見積" description={`${estimates.length} 件`} />
          <CardBody className="p-0">
            {estimates.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="見積がありません"
                description="この案件の見積を作成すると、ここに一覧表示されます。"
                action={
                  isReadOnly ? null : (
                    <LinkButton href={`/estimates/new?projectId=${project.id}`} size="sm" variant="primary">
                      <Plus aria-hidden className="size-4" />
                      見積を作成
                    </LinkButton>
                  )
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
                          <span className="tabular text-xs text-ink-muted">{estimate.estimate_number}</span>
                          <EstimateStatusBadge status={estimate.status} />
                        </div>
                        <p className="truncate font-medium text-ink">{estimate.title}</p>
                      </div>
                      <div className="shrink-0 sm:text-right">
                        <p className="tabular font-semibold text-ink">{formatYen(estimate.total_amount)}</p>
                        <p className="tabular text-xs text-ink-muted">
                          粗利率 {formatPercent(estimate.gross_margin_rate)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
