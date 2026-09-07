import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { uuid } from "@/lib/validation/common";
import { requireOrgContext } from "@/server/auth";
import { updateProjectAction } from "@/server/actions/projects";
import { listCustomerOptions } from "@/server/queries/customers";
import { getProject } from "@/server/queries/projects";

export const metadata: Metadata = { title: "工事案件を編集" };

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsed = uuid.safeParse(id);
  if (!parsed.success) notFound();

  const { organizationId } = await requireOrgContext();
  const [project, customers] = await Promise.all([
    getProject(organizationId, parsed.data),
    listCustomerOptions(organizationId),
  ]);
  if (!project) notFound();

  return (
    <>
      <PageHeader
        title="工事案件を編集"
        breadcrumb={
          <Link href={`/projects/${project.id}`} className="underline-offset-2 hover:underline">
            {project.name}
          </Link>
        }
      />
      <ProjectForm
        customers={customers}
        submitLabel="更新"
        cancelHref={`/projects/${project.id}`}
        onSubmitAction={updateProjectAction.bind(null, project.id)}
        defaultValues={{
          name: project.name,
          customerId: project.customer_id,
          workType: project.work_type,
          siteAddress: project.site_address,
          description: project.description,
          scheduledStartDate: project.scheduled_start_date ?? "",
          scheduledEndDate: project.scheduled_end_date ?? "",
          managerName: project.manager_name,
          status: project.status,
          notes: project.notes,
        }}
      />
    </>
  );
}
