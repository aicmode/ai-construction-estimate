import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { CompanyForm } from "@/components/settings/company-form";
import { requireOrgContext } from "@/server/auth";
import { getCompanySettings } from "@/server/queries/company";

export const metadata: Metadata = { title: "会社設定" };

export default async function CompanySettingsPage() {
  const { organizationId, organizationName } = await requireOrgContext();
  const settings = await getCompanySettings(organizationId);

  return (
    <>
      <PageHeader
        title="会社設定"
        description="見積書の発行元情報と、新規見積の初期値を設定します。"
      />
      <CompanyForm
        defaultValues={{
          companyName: settings?.company_name || organizationName,
          postalCode: settings?.postal_code ?? "",
          address: settings?.address ?? "",
          phone: settings?.phone ?? "",
          email: settings?.email ?? "",
          contactName: settings?.contact_name ?? "",
          invoiceRegistrationNumber: settings?.invoice_registration_number ?? "",
          bankAccount: settings?.bank_account ?? "",
          defaultTaxRate: settings?.default_tax_rate ?? 10,
          defaultValidityDays: settings?.default_validity_days ?? 30,
          defaultPaymentTerms: settings?.default_payment_terms ?? "",
        }}
      />
    </>
  );
}
