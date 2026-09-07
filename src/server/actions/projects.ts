"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { projectSchema } from "@/lib/validation/project";
import { requireOrgContext } from "@/server/auth";
import {
  type ActionResult,
  describeDatabaseError,
  failure,
  fromUnknownError,
  fromZodError,
  success,
} from "@/server/actions/result";

/**
 * Confirms that a referenced row really belongs to the caller's organization.
 * The foreign key alone would happily accept an id from another tenant, so this
 * check is what stops cross-organization references being created.
 */
async function assertCustomerInOrg(organizationId: string, customerId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .maybeSingle();
  return Boolean(data);
}

export async function createProjectAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { organizationId, user } = await requireOrgContext();
    if (!(await assertCustomerInOrg(organizationId, parsed.data.customerId))) {
      return failure("選択した顧客が見つかりません。", { customerId: ["顧客を選択し直してください。"] });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        organization_id: organizationId,
        customer_id: parsed.data.customerId,
        name: parsed.data.name,
        work_type: parsed.data.workType,
        site_address: parsed.data.siteAddress,
        description: parsed.data.description,
        scheduled_start_date: parsed.data.scheduledStartDate,
        scheduled_end_date: parsed.data.scheduledEndDate,
        manager_name: parsed.data.managerName,
        status: parsed.data.status,
        notes: parsed.data.notes,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) return failure(describeDatabaseError(error, "工事案件を登録できませんでした。"));

    revalidatePath("/projects");
    return success({ id: data.id });
  } catch (error) {
    return fromUnknownError(error, "工事案件の登録に失敗しました。");
  }
}

export async function updateProjectAction(
  projectId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { organizationId } = await requireOrgContext();
    if (!(await assertCustomerInOrg(organizationId, parsed.data.customerId))) {
      return failure("選択した顧客が見つかりません。", { customerId: ["顧客を選択し直してください。"] });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .update({
        customer_id: parsed.data.customerId,
        name: parsed.data.name,
        work_type: parsed.data.workType,
        site_address: parsed.data.siteAddress,
        description: parsed.data.description,
        scheduled_start_date: parsed.data.scheduledStartDate,
        scheduled_end_date: parsed.data.scheduledEndDate,
        manager_name: parsed.data.managerName,
        status: parsed.data.status,
        notes: parsed.data.notes,
      })
      .eq("organization_id", organizationId)
      .eq("id", projectId)
      .select("id")
      .maybeSingle();

    if (error) return failure(describeDatabaseError(error, "工事案件を更新できませんでした。"));
    if (!data) return failure("対象の工事案件が見つかりませんでした。");

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return success({ id: data.id });
  } catch (error) {
    return fromUnknownError(error, "工事案件の更新に失敗しました。");
  }
}

export async function deleteProjectAction(projectId: string): Promise<ActionResult> {
  try {
    const { organizationId } = await requireOrgContext();
    const supabase = await createClient();

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("organization_id", organizationId)
      .eq("id", projectId);

    if (error) return failure(describeDatabaseError(error, "工事案件を削除できませんでした。"));

    revalidatePath("/projects");
    return success();
  } catch (error) {
    return fromUnknownError(error, "工事案件の削除に失敗しました。");
  }
}
