import {
  ITEM_CATEGORY_LABELS,
  type ItemCategory,
  type UnitType,
  UNIT_LABELS,
} from "@/lib/domain";
import type { CalcEstimateResult } from "@/lib/estimate/calc";
import { formatPercent, formatYen } from "@/lib/money";
import type { ReviewFinding, ReviewMetrics } from "@/lib/ai/types";

export interface RuleItem {
  name: string;
  category: ItemCategory;
  description: string;
  quantity: number;
  unit: UnitType;
  unitPrice: number;
  unitCost: number;
  amount: number;
  costAmount: number;
}

export interface RuleEstimate {
  title: string;
  issueDate: string;
  validUntil: string | null;
  paymentTerms: string;
  projectId: string | null;
  taxRate: number;
  items: RuleItem[];
  totals: CalcEstimateResult;
}

/** Gross margin thresholds used across the rule engine and the summary text. */
export const MARGIN_THRESHOLDS = {
  danger: 0.1,
  warning: 0.15,
  healthy: 0.25,
} as const;

const DISCOUNT_WARNING_RATE = 0.1;
const DISCOUNT_DANGER_RATE = 0.2;
const CONCENTRATION_ITEM_SHARE = 0.4;
const CATEGORY_CONCENTRATION_SHARE = 0.8;
const LARGE_QUANTITY = 10_000;
const LARGE_UNIT_PRICE = 10_000_000;

function finding(
  id: string,
  severity: ReviewFinding["severity"],
  category: ReviewFinding["category"],
  title: string,
  description: string,
  recommendedAction: string,
  itemName: string | null = null,
): ReviewFinding {
  return { id, source: "rule", severity, category, title, description, recommendedAction, itemName };
}

export function computeMetrics(estimate: RuleEstimate): ReviewMetrics {
  const { totals, items } = estimate;

  const largestItemAmount = items.reduce((max, item) => Math.max(max, item.amount), 0);

  const byCategory = new Map<ItemCategory, number>();
  for (const item of items) {
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.amount);
  }
  const topCategoryAmount = Math.max(0, ...byCategory.values());

  return {
    itemCount: items.length,
    itemsSubtotal: totals.itemsSubtotal,
    subtotalAmount: totals.subtotalAmount,
    totalAmount: totals.totalAmount,
    costAmount: totals.costAmount,
    grossProfit: totals.grossProfit,
    grossMarginRate: totals.grossMarginRate,
    discountRate:
      totals.itemsSubtotal > 0 ? totals.discountAmount / totals.itemsSubtotal : 0,
    zeroCostItemCount: items.filter((item) => item.unitCost === 0 && item.amount > 0).length,
    zeroQuantityItemCount: items.filter((item) => item.quantity === 0).length,
    belowCostItemCount: items.filter((item) => item.unitPrice < item.unitCost).length,
    largestItemShare: totals.itemsSubtotal > 0 ? largestItemAmount / totals.itemsSubtotal : 0,
    topCategoryShare: totals.itemsSubtotal > 0 ? topCategoryAmount / totals.itemsSubtotal : 0,
  };
}

/**
 * Deterministic estimate review.
 *
 * This is the safety net that always runs: it needs no network access, no API
 * key and no model, so an AI outage can never leave a user without a check.
 * Every statement here is derived purely from the numbers in the estimate —
 * the engine deliberately makes no claim about market or industry price levels
 * because the system holds no market price data.
 */
export function runRuleReview(
  estimate: RuleEstimate,
  today: Date = new Date(),
): { findings: ReviewFinding[]; metrics: ReviewMetrics } {
  const metrics = computeMetrics(estimate);
  const findings: ReviewFinding[] = [];
  const { totals, items } = estimate;

  // --- profitability -------------------------------------------------------
  if (totals.subtotalAmount <= 0) {
    findings.push(
      finding(
        "rule.total.zero",
        "warning",
        "data_quality",
        "見積金額が0円です",
        "税抜合計が0円のままです。明細の数量・単価、または値引き額を確認してください。",
        "明細行の金額を入力し、値引き額が合計を打ち消していないか確認します。",
      ),
    );
  } else if (totals.grossProfit < 0) {
    findings.push(
      finding(
        "rule.margin.negative",
        "danger",
        "profitability",
        "粗利益がマイナスです",
        `粗利益は ${formatYen(totals.grossProfit)}、粗利率は ${formatPercent(
          totals.grossMarginRate,
        )} です。この条件で受注すると赤字になります。`,
        "原価単価の入力誤りがないか確認し、販売単価または値引き額を見直してください。",
      ),
    );
  } else if (totals.grossMarginRate < MARGIN_THRESHOLDS.danger) {
    findings.push(
      finding(
        "rule.margin.low",
        "danger",
        "profitability",
        `粗利率が${formatPercent(MARGIN_THRESHOLDS.danger, 0)}を下回っています`,
        `粗利率は ${formatPercent(totals.grossMarginRate)}（粗利益 ${formatYen(
          totals.grossProfit,
        )}）です。想定外の追加原価が発生すると赤字に転じる可能性があります。`,
        "利益を圧迫している明細を特定し、単価・数量・値引きのいずれかを調整してください。",
      ),
    );
  } else if (totals.grossMarginRate < MARGIN_THRESHOLDS.warning) {
    findings.push(
      finding(
        "rule.margin.thin",
        "warning",
        "profitability",
        "粗利率が低めです",
        `粗利率は ${formatPercent(totals.grossMarginRate)} です。社内の目標粗利率を満たしているか確認してください。`,
        "現場管理費・諸経費が明細に含まれているか確認します。",
      ),
    );
  } else if (totals.grossMarginRate >= MARGIN_THRESHOLDS.healthy) {
    findings.push(
      finding(
        "rule.margin.healthy",
        "good",
        "profitability",
        "粗利率は良好です",
        `粗利率は ${formatPercent(totals.grossMarginRate)}（粗利益 ${formatYen(
          totals.grossProfit,
        )}）です。`,
        "現状の条件を維持してください。",
      ),
    );
  }

  // --- per item checks -----------------------------------------------------
  for (const item of items) {
    if (item.unitPrice < item.unitCost) {
      findings.push(
        finding(
          `rule.item.below-cost:${item.name}`,
          "danger",
          "pricing",
          "販売単価が原価単価を下回っています",
          `「${item.name}」の販売単価 ${formatYen(item.unitPrice)} が原価単価 ${formatYen(
            item.unitCost,
          )} を下回っており、この行だけで ${formatYen(item.amount - item.costAmount)} の損失です。`,
          "単価の入力誤りか、意図的なサービス提供かを確認してください。",
          item.name,
        ),
      );
    }

    if (item.quantity === 0) {
      findings.push(
        finding(
          `rule.item.zero-quantity:${item.name}`,
          "warning",
          "data_quality",
          "数量が0の明細があります",
          `「${item.name}」の数量が0のため金額に反映されていません。`,
          "数量を入力するか、不要であれば明細行を削除してください。",
          item.name,
        ),
      );
    } else if (item.unitPrice === 0) {
      findings.push(
        finding(
          `rule.item.zero-price:${item.name}`,
          "warning",
          "data_quality",
          "販売単価が0円の明細があります",
          `「${item.name}」の販売単価が0円です。サービス項目でなければ入力漏れの可能性があります。`,
          "販売単価を入力するか、無償項目であることを摘要に明記してください。",
          item.name,
        ),
      );
    }

    if (item.quantity >= LARGE_QUANTITY) {
      findings.push(
        finding(
          `rule.item.large-quantity:${item.name}`,
          "info",
          "data_quality",
          "数量が非常に大きい明細があります",
          `「${item.name}」の数量が ${item.quantity}${UNIT_LABELS[item.unit]} です。桁の入力誤りがないか確認してください。`,
          "単位と数量の組み合わせが正しいか確認します。",
          item.name,
        ),
      );
    }

    if (item.unitPrice >= LARGE_UNIT_PRICE) {
      findings.push(
        finding(
          `rule.item.large-price:${item.name}`,
          "info",
          "data_quality",
          "販売単価が非常に高額な明細があります",
          `「${item.name}」の販売単価は ${formatYen(item.unitPrice)} です。桁の入力誤りがないか確認してください。`,
          "単価の桁数と単位を確認します。",
          item.name,
        ),
      );
    }
  }

  // --- cost coverage -------------------------------------------------------
  if (metrics.zeroCostItemCount > 0) {
    const share = metrics.zeroCostItemCount / Math.max(1, items.length);
    findings.push(
      finding(
        "rule.cost.missing",
        share >= 0.3 ? "warning" : "info",
        "data_quality",
        "原価が未入力の明細があります",
        `${metrics.zeroCostItemCount}件の明細で原価単価が0円です。原価が未入力の場合、粗利益・粗利率が実態より高く表示されます。`,
        "各明細の原価単価を入力し、粗利率を再確認してください。",
      ),
    );
  }

  // --- discount ------------------------------------------------------------
  if (metrics.discountRate >= DISCOUNT_DANGER_RATE) {
    findings.push(
      finding(
        "rule.discount.high",
        "danger",
        "profitability",
        "値引き率が非常に高くなっています",
        `値引き額 ${formatYen(totals.discountAmount)} は明細合計の ${formatPercent(
          metrics.discountRate,
        )} に相当します。`,
        "値引きの根拠と社内承認の要否を確認してください。",
      ),
    );
  } else if (metrics.discountRate >= DISCOUNT_WARNING_RATE) {
    findings.push(
      finding(
        "rule.discount.notable",
        "warning",
        "profitability",
        "値引き率が高めです",
        `値引き額 ${formatYen(totals.discountAmount)} は明細合計の ${formatPercent(
          metrics.discountRate,
        )} です。`,
        "値引き後の粗利率が目標を満たしているか確認してください。",
      ),
    );
  }

  // --- composition ---------------------------------------------------------
  if (items.length >= 3 && metrics.largestItemShare >= CONCENTRATION_ITEM_SHARE) {
    const largest = items.reduce((max, item) => (item.amount > max.amount ? item : max), items[0]);
    findings.push(
      finding(
        "rule.composition.item",
        "info",
        "composition",
        "1明細に金額が集中しています",
        `「${largest.name}」だけで明細合計の ${formatPercent(metrics.largestItemShare)} を占めています。`,
        "顧客が内訳を把握しやすいよう、必要に応じて明細を分解してください。",
        largest.name,
      ),
    );
  }

  if (items.length >= 3 && metrics.topCategoryShare >= CATEGORY_CONCENTRATION_SHARE) {
    const byCategory = new Map<ItemCategory, number>();
    for (const item of items) {
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.amount);
    }
    const [topCategory] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    findings.push(
      finding(
        "rule.composition.category",
        "info",
        "composition",
        "特定カテゴリに金額が偏っています",
        `「${ITEM_CATEGORY_LABELS[topCategory]}」が明細合計の ${formatPercent(
          metrics.topCategoryShare,
        )} を占めています。仮設・管理費・処分費などの計上漏れがないか確認してください。`,
        "工事に必要な付帯費用が漏れていないか確認します。",
      ),
    );
  }

  if (items.length === 1 && totals.itemsSubtotal >= 1_000_000) {
    findings.push(
      finding(
        "rule.composition.single-item",
        "info",
        "composition",
        "高額な見積が1行にまとめられています",
        `明細が1行のみで合計 ${formatYen(totals.itemsSubtotal)} です。内訳が分かりにくく、値引き交渉を受けやすくなります。`,
        "工種ごとに明細を分けることを検討してください。",
      ),
    );
  }

  const duplicates = new Map<string, number>();
  for (const item of items) {
    const key = item.name.trim();
    duplicates.set(key, (duplicates.get(key) ?? 0) + 1);
  }
  for (const [name, count] of duplicates) {
    if (count > 1) {
      findings.push(
        finding(
          `rule.item.duplicate:${name}`,
          "info",
          "data_quality",
          "同じ工事項目名が複数あります",
          `「${name}」が${count}行あります。二重計上でないか確認してください。`,
          "重複であれば統合、意図的であれば摘要で区別してください。",
          name,
        ),
      );
    }
  }

  // --- document completeness ----------------------------------------------
  if (!estimate.validUntil) {
    findings.push(
      finding(
        "rule.validity.missing",
        "info",
        "compliance",
        "有効期限が未設定です",
        "見積の有効期限が設定されていません。材料価格の変動リスクを抱えたままになります。",
        "有効期限を設定してください。",
      ),
    );
  } else {
    if (estimate.validUntil < estimate.issueDate) {
      findings.push(
        finding(
          "rule.validity.inverted",
          "danger",
          "schedule",
          "有効期限が発行日より前になっています",
          `発行日 ${estimate.issueDate} に対して有効期限が ${estimate.validUntil} です。`,
          "発行日と有効期限を修正してください。",
        ),
      );
    } else {
      const todayIso = toIsoDate(today);
      if (estimate.validUntil < todayIso) {
        findings.push(
          finding(
            "rule.validity.expired",
            "warning",
            "schedule",
            "有効期限が過ぎています",
            `有効期限 ${estimate.validUntil} は本日 ${todayIso} より前です。`,
            "有効期限を延長するか、ステータスを「期限切れ」に変更してください。",
          ),
        );
      }
    }
  }

  if (!estimate.paymentTerms.trim()) {
    findings.push(
      finding(
        "rule.terms.missing",
        "info",
        "compliance",
        "支払条件が未入力です",
        "支払条件が未記載のままです。入金トラブルを避けるため記載を推奨します。",
        "着手金・完了時支払などの条件を入力してください。",
      ),
    );
  }

  if (!estimate.projectId) {
    findings.push(
      finding(
        "rule.project.missing",
        "info",
        "data_quality",
        "工事案件が紐付いていません",
        "見積が工事案件に紐付いていないため、案件単位での進捗・採算管理ができません。",
        "対応する工事案件を選択してください。",
      ),
    );
  }

  return { findings: sortFindings(findings), metrics };
}

const SEVERITY_ORDER: Record<ReviewFinding["severity"], number> = {
  danger: 0,
  warning: 1,
  info: 2,
  good: 3,
};

export function sortFindings(findings: ReviewFinding[]): ReviewFinding[] {
  return [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Short headline used when the AI layer does not provide its own summary. */
export function buildRuleSummary(
  findings: ReviewFinding[],
  metrics: ReviewMetrics,
): string {
  const danger = findings.filter((f) => f.severity === "danger").length;
  const warning = findings.filter((f) => f.severity === "warning").length;
  const parts = [
    `明細${metrics.itemCount}件・税込 ${formatYen(metrics.totalAmount)}、粗利率 ${formatPercent(
      metrics.grossMarginRate,
    )}。`,
  ];
  if (danger > 0) {
    parts.push(`要対応の指摘が${danger}件あります。提出前に必ず確認してください。`);
  } else if (warning > 0) {
    parts.push(`注意点が${warning}件あります。内容を確認してください。`);
  } else {
    parts.push("ルールチェックで重大な問題は検出されませんでした。");
  }
  return parts.join("");
}
