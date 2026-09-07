import type { Metadata } from "next";

import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { ReadOnlyFormPlaceholder } from "@/components/ui/read-only-notice";
import { CustomerForm } from "@/components/customers/customer-form";
import { requireOrgContext } from "@/server/auth";
import { createCustomerAction } from "@/server/actions/customers";

export const metadata: Metadata = { title: "顧客を登録" };

export default async function NewCustomerPage() {
  const { isReadOnly } = await requireOrgContext();

  return (
    <>
      <PageHeader
        title="顧客を登録"
        breadcrumb={
          <Link href="/customers" className="underline-offset-2 hover:underline">
            顧客一覧
          </Link>
        }
      />
      {isReadOnly ? (
        <ReadOnlyFormPlaceholder backHref="/customers" backLabel="顧客一覧に戻る" />
      ) : (
        <CustomerForm
          submitLabel="登録"
          cancelHref="/customers"
          onSubmitAction={createCustomerAction}
          defaultValues={{
            name: "",
            companyName: "",
            contactName: "",
            phone: "",
            email: "",
            postalCode: "",
            address: "",
            notes: "",
          }}
        />
      )}
    </>
  );
}
