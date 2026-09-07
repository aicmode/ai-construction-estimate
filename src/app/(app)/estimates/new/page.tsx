import type { Metadata } from "next";

import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { EMPTY_ITEM, EstimateEditor } from "@/components/estimates/estimate-editor";
import { requireOrgContext } from "@/server/auth";
import { createEstimateAction } from "@/server/actions/estimates";
import { getCompanySettings } from "@/server/queries/company";
import { listCustomerOptions } from "@/server/queries/customers";
import { listProjectOptions } from "@/server/queries/projects";
import { toIso } from "@/server/queries/util";

export const metadata: Metadata = { title: "見積を作成" };

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; customerId?: string }>;
}) {
  const { projectId, customerId } = await searchParams;
  const { organizationId } = await requireOrgContext();

  const [customers, projects, company] = await Promise.all([
    listCustomerOptions(organizationId),
    listProjectOptions(organizationId),
    getCompanySettings(organizationId),
  ]);

  // Only accept ids that actually belong to this organization.
  const project = projects.find((candidate) => candidate.id === projectId) ?? null;
  const preselectedCustomerId =
    project?.customerId ??
    (customers.some((customer) => customer.id === customerId) ? customerId! : "");

  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + (company?.default_validity_days ?? 30));

  return (
    <>
      <PageHeader
        title="見積を作成"
        description="明細を入力すると、金額・原価・粗利がリアルタイムに計算されます。"
        breadcrumb={
          <Link href="/estimates" className="underline-offset-2 hover:underline">
            見積一覧
          </Link>
        }
      />
      <EstimateEditor
        customers={customers}
        projects={projects}
        submitLabel="作成"
        cancelHref="/estimates"
        onSubmitAction={createEstimateAction}
        defaultValues={{
          title: project ? `${project.name}　工事一式` : "",
          customerId: preselectedCustomerId,
          projectId: project?.id ?? "",
          issueDate: toIso(today),
          validUntil: toIso(validUntil),
          status: "DRAFT",
          taxRate: company?.default_tax_rate ?? 10,
          discountAmount: 0,
          paymentTerms: company?.default_payment_terms ?? "",
          notes: "",
          items: [{ ...EMPTY_ITEM }],
        }}
      />
    </>
  );
}
