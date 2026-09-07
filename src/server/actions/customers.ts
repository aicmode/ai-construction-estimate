"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { customerSchema } from "@/lib/validation/customer";
import { READ_ONLY_MESSAGE, requireOrgContext } from "@/server/auth";
import {
  type ActionResult,
  describeDatabaseError,
  failure,
  fromUnknownError,
  fromZodError,
  success,
} from "@/server/actions/result";

export async function createCustomerAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { organizationId, user, isReadOnly } = await requireOrgContext();
    if (isReadOnly) return failure(READ_ONLY_MESSAGE);

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("customers")
      .insert({
        organization_id: organizationId,
        name: parsed.data.name,
        company_name: parsed.data.companyName,
        contact_name: parsed.data.contactName,
        phone: parsed.data.phone,
        email: parsed.data.email,
        postal_code: parsed.data.postalCode,
        address: parsed.data.address,
        notes: parsed.data.notes,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) return failure(describeDatabaseError(error, "顧客を登録できませんでした。"));

    revalidatePath("/customers");
    return success({ id: data.id });
  } catch (error) {
    return fromUnknownError(error, "顧客の登録に失敗しました。");
  }
}

export async function updateCustomerAction(
  customerId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { organizationId, isReadOnly } = await requireOrgContext();
    if (isReadOnly) return failure(READ_ONLY_MESSAGE);

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("customers")
      .update({
        name: parsed.data.name,
        company_name: parsed.data.companyName,
        contact_name: parsed.data.contactName,
        phone: parsed.data.phone,
        email: parsed.data.email,
        postal_code: parsed.data.postalCode,
        address: parsed.data.address,
        notes: parsed.data.notes,
      })
      // `organization_id` is part of the predicate as well as the RLS policy:
      // an id taken from another organization simply matches no rows.
      .eq("organization_id", organizationId)
      .eq("id", customerId)
      .select("id")
      .maybeSingle();

    if (error) return failure(describeDatabaseError(error, "顧客を更新できませんでした。"));
    if (!data) return failure("対象の顧客が見つかりませんでした。");

    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    return success({ id: data.id });
  } catch (error) {
    return fromUnknownError(error, "顧客の更新に失敗しました。");
  }
}

export async function deleteCustomerAction(customerId: string): Promise<ActionResult> {
  try {
    const { organizationId, isReadOnly } = await requireOrgContext();
    if (isReadOnly) return failure(READ_ONLY_MESSAGE);

    const supabase = await createClient();

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("organization_id", organizationId)
      .eq("id", customerId);

    if (error) {
      // 23503: the customer is still referenced by projects or estimates.
      return failure(
        error.code === "23503"
          ? "この顧客には工事案件または見積が紐付いているため削除できません。"
          : describeDatabaseError(error, "顧客を削除できませんでした。"),
      );
    }

    revalidatePath("/customers");
    return success();
  } catch (error) {
    return fromUnknownError(error, "顧客の削除に失敗しました。");
  }
}
