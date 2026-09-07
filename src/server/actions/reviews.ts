"use server";

import { revalidatePath } from "next/cache";

import { reviewEstimate } from "@/lib/ai/review";
import type { RuleEstimate } from "@/lib/ai/rules";
import type { ReviewResult } from "@/lib/ai/types";
import { calcEstimate } from "@/lib/estimate/calc";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/common";
import { requireOrgContext } from "@/server/auth";
import { getEstimateDetail } from "@/server/queries/estimates";
import {
  type ActionResult,
  failure,
  fromUnknownError,
  success,
} from "@/server/actions/result";

/**
 * Runs the estimate review.
 *
 * The estimate is re-read from the database, so the analysed numbers are the
 * stored ones — a client cannot ask the AI to review a payload it invented. The
 * deterministic rule engine always runs; the AI provider is optional.
 */
export async function runEstimateReviewAction(
  estimateIdInput: unknown,
): Promise<ActionResult<ReviewResult>> {
  const parsed = uuid.safeParse(estimateIdInput);
  if (!parsed.success) return failure("見積IDが不正です。");
  const estimateId = parsed.data;

  try {
    const { organizationId, user } = await requireOrgContext();
    const detail = await getEstimateDetail(organizationId, estimateId);
    if (!detail) return failure("対象の見積が見つかりませんでした。");
    if (detail.items.length === 0) return failure("明細が登録されていないためレビューできません。");

    const totals = calcEstimate({
      items: detail.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unit_price,
        unitCost: item.unit_cost,
      })),
      taxRate: detail.tax_rate,
      discountAmount: detail.discount_amount,
    });

    const target: RuleEstimate = {
      title: detail.title,
      issueDate: detail.issue_date,
      validUntil: detail.valid_until,
      paymentTerms: detail.payment_terms,
      projectId: detail.project_id,
      taxRate: detail.tax_rate,
      items: detail.items.map((item) => ({
        name: item.name,
        category: item.category,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unit_price,
        unitCost: item.unit_cost,
        amount: item.amount,
        costAmount: item.cost_amount,
      })),
      totals,
    };

    const result = await reviewEstimate(target);

    const supabase = await createClient();
    const { error } = await supabase.from("ai_reviews").insert({
      organization_id: organizationId,
      estimate_id: estimateId,
      source: result.source,
      model: result.model,
      summary: result.summary,
      findings: result.findings,
      metrics: result.metrics,
      ai_error: result.aiError,
      created_by: user.id,
    });

    // A failure to archive the review must not hide the review itself.
    if (error) console.error("[review] failed to persist", error.code, error.message);

    revalidatePath(`/estimates/${estimateId}`);
    return success(result);
  } catch (error) {
    return fromUnknownError(error, "AIレビューの実行に失敗しました。");
  }
}
