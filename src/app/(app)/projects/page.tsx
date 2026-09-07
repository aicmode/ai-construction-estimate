import type { Metadata } from "next";

import Link from "next/link";

import { HardHat, Plus, Search } from "lucide-react";

import { LinkButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectStatusBadge } from "@/components/ui/badge";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  WORK_TYPES,
  WORK_TYPE_LABELS,
  type ProjectStatus,
  type WorkType,
} from "@/lib/domain";
import { requireOrgContext } from "@/server/auth";
import { listProjects } from "@/server/queries/projects";

export const metadata: Metadata = { title: "工事案件" };

function parseStatus(value: string | undefined): ProjectStatus | undefined {
  return PROJECT_STATUSES.find((status) => status === value);
}

function parseWorkType(value: string | undefined): WorkType | undefined {
  return WORK_TYPES.find((type) => type === value);
}

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("ja-JP").format(new Date(value)) : "—";
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; workType?: string }>;
}) {
  const raw = await searchParams;
  const filter = {
    q: raw.q,
    status: parseStatus(raw.status),
    workType: parseWorkType(raw.workType),
  };

  const { organizationId } = await requireOrgContext();
  const projects = await listProjects(organizationId, filter);

  return (
    <>
      <PageHeader
        title="工事案件"
        description="顧客ごとの工事案件を管理し、見積と紐付けます。"
        actions={
          <LinkButton href="/projects/new" variant="primary">
            <Plus aria-hidden className="size-4" />
            案件を登録
          </LinkButton>
        }
      />

      <Card>
        <CardBody className="border-b border-steel-200">
          <form method="get" role="search" className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-steel-400"
              />
              <label htmlFor="q" className="sr-only">
                案件名・施工場所・担当者で検索
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={raw.q ?? ""}
                placeholder="案件名・施工場所・担当者で検索"
                className="h-11 w-full rounded-md border border-steel-300 bg-white pr-3 pl-9 text-[0.95rem] placeholder:text-steel-400 hover:border-steel-400 focus:border-amber-accent"
              />
            </div>

            <div>
              <label htmlFor="status" className="sr-only">
                ステータス
              </label>
              <select
                id="status"
                name="status"
                defaultValue={raw.status ?? ""}
                className="h-11 w-full rounded-md border border-steel-300 bg-white px-3 text-[0.95rem] sm:w-40"
              >
                <option value="">全ステータス</option>
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PROJECT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="workType" className="sr-only">
                工事種別
              </label>
              <select
                id="workType"
                name="workType"
                defaultValue={raw.workType ?? ""}
                className="h-11 w-full rounded-md border border-steel-300 bg-white px-3 text-[0.95rem] sm:w-36"
              >
                <option value="">全種別</option>
                {WORK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {WORK_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="h-11 rounded-md border border-steel-300 bg-white px-5 font-medium text-steel-800 hover:bg-steel-50"
            >
              絞り込む
            </button>
          </form>
        </CardBody>

        <CardBody className="p-0">
          {projects.length === 0 ? (
            <EmptyState
              icon={HardHat}
              title="工事案件が見つかりません"
              description="条件を変更するか、新しい案件を登録してください。"
              action={
                <LinkButton href="/projects/new" size="sm" variant="primary">
                  <Plus aria-hidden className="size-4" />
                  案件を登録
                </LinkButton>
              }
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-steel-200 bg-steel-50 text-xs text-ink-muted">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">案件名</th>
                      <th scope="col" className="px-5 py-3 font-medium">顧客</th>
                      <th scope="col" className="px-5 py-3 font-medium">工事種別</th>
                      <th scope="col" className="px-5 py-3 font-medium">工期</th>
                      <th scope="col" className="px-5 py-3 font-medium">ステータス</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">見積</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr key={project.id} className="border-b border-steel-100 last:border-b-0 hover:bg-steel-50">
                        <td className="px-5 py-3">
                          <Link
                            href={`/projects/${project.id}`}
                            className="font-medium text-ink underline-offset-2 hover:underline"
                          >
                            {project.name}
                          </Link>
                          {project.site_address ? (
                            <p className="text-xs text-ink-muted">{project.site_address}</p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 text-ink-soft">{project.customerName}</td>
                        <td className="px-5 py-3 text-ink-soft">{WORK_TYPE_LABELS[project.work_type]}</td>
                        <td className="tabular px-5 py-3 text-xs text-ink-soft">
                          {formatDate(project.scheduled_start_date)} 〜 {formatDate(project.scheduled_end_date)}
                        </td>
                        <td className="px-5 py-3">
                          <ProjectStatusBadge status={project.status} />
                        </td>
                        <td className="tabular px-5 py-3 text-right text-ink-soft">{project.estimateCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="lg:hidden">
                {projects.map((project) => (
                  <li key={project.id} className="border-b border-steel-100 last:border-b-0">
                    <Link href={`/projects/${project.id}`} className="block px-4 py-3.5 hover:bg-steel-50">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 font-medium text-ink">{project.name}</p>
                        <ProjectStatusBadge status={project.status} />
                      </div>
                      <p className="mt-1 text-sm text-ink-soft">{project.customerName}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {WORK_TYPE_LABELS[project.work_type]}
                        {project.site_address ? `・${project.site_address}` : ""}
                      </p>
                      <p className="tabular mt-1 text-xs text-ink-muted">
                        {formatDate(project.scheduled_start_date)} 〜 {formatDate(project.scheduled_end_date)}・見積 {project.estimateCount} 件
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
