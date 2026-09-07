import type { Metadata } from "next";

import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { requireOrgContext } from "@/server/auth";
import { createProjectAction } from "@/server/actions/projects";
import { listCustomerOptions } from "@/server/queries/customers";

export const metadata: Metadata = { title: "工事案件を登録" };

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
  const { organizationId } = await requireOrgContext();
  const customers = await listCustomerOptions(organizationId);

  // Only pre-select a customer that actually belongs to this organization.
  const preselected = customers.some((customer) => customer.id === customerId) ? customerId : "";

  return (
    <>
      <PageHeader
        title="工事案件を登録"
        breadcrumb={
          <Link href="/projects" className="underline-offset-2 hover:underline">
            工事案件一覧
          </Link>
        }
      />
      <ProjectForm
        customers={customers}
        submitLabel="登録"
        cancelHref="/projects"
        onSubmitAction={createProjectAction}
        defaultValues={{
          name: "",
          customerId: preselected ?? "",
          workType: "reform",
          siteAddress: "",
          description: "",
          scheduledStartDate: "",
          scheduledEndDate: "",
          managerName: "",
          status: "planning",
          notes: "",
        }}
      />
    </>
  );
}
