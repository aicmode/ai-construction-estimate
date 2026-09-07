import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { EstimateEditor } from "@/components/estimates/estimate-editor";
import { uuid } from "@/lib/validation/common";
import { requireOrgContext } from "@/server/auth";
import { updateEstimateAction } from "@/server/actions/estimates";
import { listCustomerOptions } from "@/server/queries/customers";
import { getEstimateDetail } from "@/server/queries/estimates";
import { listProjectOptions } from "@/server/queries/projects";

export const metadata: Metadata = { title: "見積を編集" };

export default async function EditEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsed = uuid.safeParse(id);
  if (!parsed.success) notFound();

  const { organizationId } = await requireOrgContext();
  const [estimate, customers, projects] = await Promise.all([
    getEstimateDetail(organizationId, parsed.data),
    listCustomerOptions(organizationId),
    listProjectOptions(organizationId),
  ]);
  if (!estimate) notFound();

  return (
    <>
      <PageHeader
        title="見積を編集"
        description={`${estimate.estimate_number}`}
        breadcrumb={
          <Link href={`/estimates/${estimate.id}`} className="underline-offset-2 hover:underline">
            {estimate.title}
          </Link>
        }
      />
      <EstimateEditor
        customers={customers}
        projects={projects}
        submitLabel="更新"
        cancelHref={`/estimates/${estimate.id}`}
        onSubmitAction={updateEstimateAction.bind(null, estimate.id)}
        defaultValues={{
          title: estimate.title,
          customerId: estimate.customer_id,
          projectId: estimate.project_id ?? "",
          issueDate: estimate.issue_date,
          validUntil: estimate.valid_until ?? "",
          status: estimate.status,
          taxRate: estimate.tax_rate,
          discountAmount: estimate.discount_amount,
          paymentTerms: estimate.payment_terms,
          notes: estimate.notes,
          items: estimate.items.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unit_price,
            unitCost: item.unit_cost,
          })),
        }}
      />
    </>
  );
}
