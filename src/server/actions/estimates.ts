"use server";

import { revalidatePath } from "next/cache";

import type { SaveEstimateItem } from "@/lib/database.types";
import { calcEstimate } from "@/lib/estimate/calc";
import { createClient } from "@/lib/supabase/server";
import {
  estimateSchema,
  estimateStatusChangeSchema,
  type EstimateInput,
} from "@/lib/validation/estimate";
import { READ_ONLY_MESSAGE, requireOrgContext } from "@/server/auth";
import { getEstimateDetail } from "@/server/queries/estimates";
import {
  type ActionResult,
  describeDatabaseError,
  failure,
  fromUnknownError,
  fromZodError,
  success,
} from "@/server/actions/result";

/**
 * Recomputes every monetary field from the raw quantities and unit rates.
 *
 * The client sends only the inputs a human typed; the amounts it displays are
 * never persisted. Anything the browser claims about subtotals, tax or margin
 * is discarded here and replaced by the result of the shared calculator.
 */
function buildPersistablePayload(input: EstimateInput) {
  const totals = calcEstimate({
    items: input.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
    })),
    taxRate: input.taxRate,
    discountAmount: input.discountAmount,
  });

  const items: SaveEstimateItem[] = input.items.map((item, index) => ({
    name: item.name,
    category: item.category,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unitPrice,
    unit_cost: item.unitCost,
    amount: totals.items[index].amount,
    cost_amount: totals.items[index].costAmount,
  }));

  return { totals, items };
}

async function allocateEstimateNumber(organizationId: string, issueDate: string): Promise<string> {
  const supabase = await createClient();
  const year = Number(issueDate.slice(0, 4));
  const { data, error } = await supabase.rpc("next_estimate_number", {
    p_org: organizationId,
    p_year: Number.isFinite(year) ? year : new Date().getFullYear(),
  });
  if (error || !data) {
    throw new Error(`見積番号を採番できませんでした: ${error?.message ?? "unknown"}`);
  }
  return data;
}

export async function createEstimateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = estimateSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { organizationId, isReadOnly } = await requireOrgContext();
    if (isReadOnly) return failure(READ_ONLY_MESSAGE);

    const { totals, items } = buildPersistablePayload(parsed.data);
    const estimateNumber = await allocateEstimateNumber(organizationId, parsed.data.issueDate);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_estimate", {
      p_org: organizationId,
      p_estimate_id: null,
      p_customer_id: parsed.data.customerId,
      p_project_id: parsed.data.projectId,
      p_estimate_number: estimateNumber,
      p_title: parsed.data.title,
      p_issue_date: parsed.data.issueDate,
      p_valid_until: parsed.data.validUntil,
      p_status: parsed.data.status,
      p_payment_terms: parsed.data.paymentTerms,
      p_notes: parsed.data.notes,
      p_tax_rate: parsed.data.taxRate,
      p_discount_amount: totals.discountAmount,
      p_items_subtotal: totals.itemsSubtotal,
      p_subtotal_amount: totals.subtotalAmount,
      p_tax_amount: totals.taxAmount,
      p_total_amount: totals.totalAmount,
      p_cost_amount: totals.costAmount,
      p_gross_profit: totals.grossProfit,
      p_gross_margin_rate: totals.grossMarginRate,
      p_items: items,
    });

    if (error) return failure(describeDatabaseError(error, "見積を作成できませんでした。"));

    revalidatePath("/estimates");
    revalidatePath("/dashboard");
    return success({ id: data });
  } catch (error) {
    return fromUnknownError(error, "見積の作成に失敗しました。");
  }
}

export async function updateEstimateAction(
  estimateId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = estimateSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { organizationId, isReadOnly } = await requireOrgContext();
    if (isReadOnly) return failure(READ_ONLY_MESSAGE);

    const { totals, items } = buildPersistablePayload(parsed.data);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_estimate", {
      p_org: organizationId,
      p_estimate_id: estimateId,
      p_customer_id: parsed.data.customerId,
      p_project_id: parsed.data.projectId,
      p_estimate_number: "",
      p_title: parsed.data.title,
      p_issue_date: parsed.data.issueDate,
      p_valid_until: parsed.data.validUntil,
      p_status: parsed.data.status,
      p_payment_terms: parsed.data.paymentTerms,
      p_notes: parsed.data.notes,
      p_tax_rate: parsed.data.taxRate,
      p_discount_amount: totals.discountAmount,
      p_items_subtotal: totals.itemsSubtotal,
      p_subtotal_amount: totals.subtotalAmount,
      p_tax_amount: totals.taxAmount,
      p_total_amount: totals.totalAmount,
      p_cost_amount: totals.costAmount,
      p_gross_profit: totals.grossProfit,
      p_gross_margin_rate: totals.grossMarginRate,
      p_items: items,
    });

    if (error) return failure(describeDatabaseError(error, "見積を更新できませんでした。"));

    revalidatePath("/estimates");
    revalidatePath(`/estimates/${estimateId}`);
    revalidatePath("/dashboard");
    return success({ id: data });
  } catch (error) {
    return fromUnknownError(error, "見積の更新に失敗しました。");
  }
}

export async function changeEstimateStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = estimateStatusChangeSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { organizationId, isReadOnly } = await requireOrgContext();
    if (isReadOnly) return failure(READ_ONLY_MESSAGE);

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("estimates")
      .update({ status: parsed.data.status })
      .eq("organization_id", organizationId)
      .eq("id", parsed.data.estimateId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) return failure(describeDatabaseError(error, "ステータスを変更できませんでした。"));
    if (!data) return failure("対象の見積が見つかりませんでした。");

    revalidatePath("/estimates");
    revalidatePath(`/estimates/${parsed.data.estimateId}`);
    revalidatePath("/dashboard");
    return success();
  } catch (error) {
    return fromUnknownError(error, "ステータスの変更に失敗しました。");
  }
}

/**
 * Copies an estimate into a fresh DRAFT with a newly allocated number. The
 * source is re-read from the database rather than trusting anything sent by the
 * browser.
 */
export async function duplicateEstimateAction(
  estimateId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { organizationId, isReadOnly } = await requireOrgContext();
    if (isReadOnly) return failure(READ_ONLY_MESSAGE);

    const source = await getEstimateDetail(organizationId, estimateId);
    if (!source) return failure("複製元の見積が見つかりませんでした。");
    if (source.items.length === 0) return failure("明細のない見積は複製できません。");

    const today = new Date();
    const issueDate = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`;
    const estimateNumber = await allocateEstimateNumber(organizationId, issueDate);

    const totals = calcEstimate({
      items: source.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unit_price,
        unitCost: item.unit_cost,
      })),
      taxRate: source.tax_rate,
      discountAmount: source.discount_amount,
    });

    const items: SaveEstimateItem[] = source.items.map((item, index) => ({
      name: item.name,
      category: item.category,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      unit_cost: item.unit_cost,
      amount: totals.items[index].amount,
      cost_amount: totals.items[index].costAmount,
    }));

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_estimate", {
      p_org: organizationId,
      p_estimate_id: null,
      p_customer_id: source.customer_id,
      p_project_id: source.project_id,
      p_estimate_number: estimateNumber,
      p_title: `${source.title}（複製）`.slice(0, 160),
      p_issue_date: issueDate,
      p_valid_until: null,
      p_status: "DRAFT",
      p_payment_terms: source.payment_terms,
      p_notes: source.notes,
      p_tax_rate: source.tax_rate,
      p_discount_amount: totals.discountAmount,
      p_items_subtotal: totals.itemsSubtotal,
      p_subtotal_amount: totals.subtotalAmount,
      p_tax_amount: totals.taxAmount,
      p_total_amount: totals.totalAmount,
      p_cost_amount: totals.costAmount,
      p_gross_profit: totals.grossProfit,
      p_gross_margin_rate: totals.grossMarginRate,
      p_items: items,
    });

    if (error) return failure(describeDatabaseError(error, "見積を複製できませんでした。"));

    revalidatePath("/estimates");
    revalidatePath("/dashboard");
    return success({ id: data });
  } catch (error) {
    return fromUnknownError(error, "見積の複製に失敗しました。");
  }
}

/**
 * Logical delete. The row and its items stay in PostgreSQL so an accidental
 * deletion can be recovered by an administrator, while every application query
 * filters on `deleted_at is null`.
 */
export async function deleteEstimateAction(estimateId: string): Promise<ActionResult> {
  try {
    const { organizationId, isReadOnly } = await requireOrgContext();
    if (isReadOnly) return failure(READ_ONLY_MESSAGE);

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("estimates")
      .update({ deleted_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", estimateId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) return failure(describeDatabaseError(error, "見積を削除できませんでした。"));
    if (!data) return failure("対象の見積が見つかりませんでした。");

    revalidatePath("/estimates");
    revalidatePath("/dashboard");
    return success();
  } catch (error) {
    return fromUnknownError(error, "見積の削除に失敗しました。");
  }
}
