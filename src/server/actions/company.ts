"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { companySettingsSchema } from "@/lib/validation/company";
import { READ_ONLY_MESSAGE, requireOrgContext } from "@/server/auth";
import {
  type ActionResult,
  describeDatabaseError,
  failure,
  fromUnknownError,
  fromZodError,
  success,
} from "@/server/actions/result";

export async function saveCompanySettingsAction(input: unknown): Promise<ActionResult> {
  const parsed = companySettingsSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { organizationId, isReadOnly } = await requireOrgContext();
    if (isReadOnly) return failure(READ_ONLY_MESSAGE);

    const supabase = await createClient();

    const payload = {
      organization_id: organizationId,
      company_name: parsed.data.companyName,
      postal_code: parsed.data.postalCode,
      address: parsed.data.address,
      phone: parsed.data.phone,
      email: parsed.data.email,
      contact_name: parsed.data.contactName,
      invoice_registration_number: parsed.data.invoiceRegistrationNumber,
      bank_account: parsed.data.bankAccount,
      default_tax_rate: parsed.data.defaultTaxRate,
      default_validity_days: parsed.data.defaultValidityDays,
      default_payment_terms: parsed.data.defaultPaymentTerms,
    };

    // One settings row per organization, guaranteed by the UNIQUE constraint on
    // `organization_id`; upsert keeps the action idempotent.
    const { error } = await supabase
      .from("company_settings")
      .upsert(payload, { onConflict: "organization_id" });

    if (error) return failure(describeDatabaseError(error, "会社設定を保存できませんでした。"));

    revalidatePath("/settings/company");
    return success();
  } catch (error) {
    return fromUnknownError(error, "会社設定の保存に失敗しました。");
  }
}
