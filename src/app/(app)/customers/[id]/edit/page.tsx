import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { ReadOnlyFormPlaceholder } from "@/components/ui/read-only-notice";
import { CustomerForm } from "@/components/customers/customer-form";
import { uuid } from "@/lib/validation/common";
import { requireOrgContext } from "@/server/auth";
import { updateCustomerAction } from "@/server/actions/customers";
import { getCustomer } from "@/server/queries/customers";

export const metadata: Metadata = { title: "顧客を編集" };

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsed = uuid.safeParse(id);
  if (!parsed.success) notFound();

  const { organizationId, isReadOnly } = await requireOrgContext();
  const customer = await getCustomer(organizationId, parsed.data);
  if (!customer) notFound();

  return (
    <>
      <PageHeader
        title="顧客を編集"
        breadcrumb={
          <Link href={`/customers/${customer.id}`} className="underline-offset-2 hover:underline">
            {customer.name}
          </Link>
        }
      />
      {isReadOnly ? (
        <ReadOnlyFormPlaceholder backHref={`/customers/${customer.id}`} backLabel="顧客詳細に戻る" />
      ) : (
        <CustomerForm
          submitLabel="更新"
          cancelHref={`/customers/${customer.id}`}
          // Bound server action: the id comes from the verified server context,
          // not from anything the client can change.
          onSubmitAction={updateCustomerAction.bind(null, customer.id)}
          defaultValues={{
            name: customer.name,
            companyName: customer.company_name,
            contactName: customer.contact_name,
            phone: customer.phone,
            email: customer.email,
            postalCode: customer.postal_code,
            address: customer.address,
            notes: customer.notes,
          }}
        />
      )}
    </>
  );
}
