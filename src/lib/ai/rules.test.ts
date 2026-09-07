import { describe, expect, it } from "vitest";

import { aiResponseSchema } from "@/lib/ai/types";
import { type RuleEstimate, type RuleItem, runRuleReview } from "@/lib/ai/rules";
import { calcEstimate } from "@/lib/estimate/calc";

function item(overrides: Partial<RuleItem> = {}): RuleItem {
  const base = {
    name: "システムキッチン交換",
    category: "equipment" as const,
    description: "",
    quantity: 1,
    unit: "set" as const,
    unitPrice: 800_000,
    unitCost: 560_000,
  };
  const merged = { ...base, ...overrides };
  return {
    ...merged,
    amount: Math.round(merged.quantity * merged.unitPrice),
    costAmount: Math.round(merged.quantity * merged.unitCost),
  };
}

function estimate(
  items: RuleItem[],
  overrides: Partial<Omit<RuleEstimate, "items" | "totals">> & { discountAmount?: number } = {},
): RuleEstimate {
  const { discountAmount = 0, ...rest } = overrides;
  const totals = calcEstimate({
    items: items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      unitCost: i.unitCost,
    })),
    taxRate: 10,
    discountAmount,
  });
  return {
    title: "戸建てキッチン改修工事",
    issueDate: "2026-05-01",
    validUntil: "2026-06-30",
    paymentTerms: "着手金50%・完了時50%",
    projectId: "00000000-0000-4000-8000-000000000001",
    taxRate: 10,
    items,
    totals,
    ...rest,
  };
}

const TODAY = new Date("2026-05-15T00:00:00+09:00");
const ids = (result: ReturnType<typeof runRuleReview>) => result.findings.map((f) => f.id);

describe("runRuleReview", () => {
  it("reports a healthy margin on a well formed estimate", () => {
    const result = runRuleReview(estimate([item(), item({ name: "内装補修", category: "interior_finish" })]), TODAY);
    expect(ids(result)).toContain("rule.margin.healthy");
    expect(result.findings.every((f) => f.severity !== "danger")).toBe(true);
  });

  it("flags a negative gross profit as dangerous", () => {
    const result = runRuleReview(
      estimate([item({ unitPrice: 400_000, unitCost: 560_000 })]),
      TODAY,
    );
    expect(ids(result)).toContain("rule.margin.negative");
    expect(result.findings.find((f) => f.id === "rule.margin.negative")?.severity).toBe("danger");
  });

  it("flags a thin margin below the danger threshold", () => {
    const result = runRuleReview(
      estimate([item({ unitPrice: 1_000_000, unitCost: 950_000 })]),
      TODAY,
    );
    expect(ids(result)).toContain("rule.margin.low");
  });

  it("detects a selling price below the unit cost", () => {
    const result = runRuleReview(
      estimate([
        item(),
        item({ name: "廃材処分", category: "waste_disposal", unitPrice: 20_000, unitCost: 35_000 }),
      ]),
      TODAY,
    );
    const finding = result.findings.find((f) => f.id.startsWith("rule.item.below-cost"));
    expect(finding?.severity).toBe("danger");
    expect(finding?.itemName).toBe("廃材処分");
    expect(result.metrics.belowCostItemCount).toBe(1);
  });

  it("detects zero quantity and zero unit price rows", () => {
    const result = runRuleReview(
      estimate([item(), item({ name: "養生費", quantity: 0 }), item({ name: "諸経費", unitPrice: 0, unitCost: 0 })]),
      TODAY,
    );
    expect(ids(result)).toContain("rule.item.zero-quantity:養生費");
    expect(ids(result)).toContain("rule.item.zero-price:諸経費");
    expect(result.metrics.zeroQuantityItemCount).toBe(1);
  });

  it("escalates the discount finding by ratio", () => {
    const light = runRuleReview(estimate([item()], { discountAmount: 96_000 }), TODAY);
    expect(ids(light)).toContain("rule.discount.notable");

    const heavy = runRuleReview(estimate([item()], { discountAmount: 200_000 }), TODAY);
    expect(ids(heavy)).toContain("rule.discount.high");
    expect(heavy.findings.find((f) => f.id === "rule.discount.high")?.severity).toBe("danger");
  });

  it("flags an inverted validity window", () => {
    const result = runRuleReview(
      estimate([item()], { issueDate: "2026-05-01", validUntil: "2026-04-01" }),
      TODAY,
    );
    expect(ids(result)).toContain("rule.validity.inverted");
  });

  it("flags an already expired estimate", () => {
    const result = runRuleReview(
      estimate([item()], { issueDate: "2026-01-01", validUntil: "2026-02-01" }),
      TODAY,
    );
    expect(ids(result)).toContain("rule.validity.expired");
  });

  it("flags missing document information", () => {
    const result = runRuleReview(
      estimate([item()], { validUntil: null, paymentTerms: "", projectId: null }),
      TODAY,
    );
    expect(ids(result)).toEqual(
      expect.arrayContaining([
        "rule.validity.missing",
        "rule.terms.missing",
        "rule.project.missing",
      ]),
    );
  });

  it("flags missing cost data", () => {
    const result = runRuleReview(
      estimate([item({ unitCost: 0 }), item({ name: "解体", unitCost: 0 })]),
      TODAY,
    );
    const finding = result.findings.find((f) => f.id === "rule.cost.missing");
    expect(finding?.severity).toBe("warning");
    expect(result.metrics.zeroCostItemCount).toBe(2);
  });

  it("flags concentration in a single line and duplicated names", () => {
    const result = runRuleReview(
      estimate([
        item({ name: "本体工事", unitPrice: 2_000_000, unitCost: 1_300_000 }),
        item({ name: "諸経費", unitPrice: 50_000, unitCost: 10_000 }),
        item({ name: "諸経費", unitPrice: 30_000, unitCost: 10_000 }),
      ]),
      TODAY,
    );
    expect(ids(result)).toContain("rule.composition.item");
    expect(ids(result)).toContain("rule.item.duplicate:諸経費");
  });

  it("warns when the estimate totals zero", () => {
    const result = runRuleReview(
      estimate([item({ unitPrice: 0, unitCost: 0, quantity: 1 })]),
      TODAY,
    );
    expect(ids(result)).toContain("rule.total.zero");
  });

  it("orders findings by severity", () => {
    const result = runRuleReview(
      estimate([item({ unitPrice: 100_000, unitCost: 200_000 })], {
        validUntil: null,
        paymentTerms: "",
      }),
      TODAY,
    );
    const severities = result.findings.map((f) => f.severity);
    const rank = { danger: 0, warning: 1, info: 2, good: 3 } as const;
    const ranks = severities.map((s) => rank[s]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("never asserts a market or industry price level", () => {
    const result = runRuleReview(
      estimate([item({ unitPrice: 90_000_000, unitCost: 1_000 })]),
      TODAY,
    );
    const text = result.findings.map((f) => `${f.title}${f.description}${f.recommendedAction}`).join("");
    for (const forbidden of ["相場", "市場価格", "業界平均", "一般的な価格"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("computes metrics without dividing by zero on an empty estimate", () => {
    const result = runRuleReview(estimate([]), TODAY);
    expect(result.metrics).toMatchObject({
      itemCount: 0,
      largestItemShare: 0,
      topCategoryShare: 0,
      discountRate: 0,
      grossMarginRate: 0,
    });
  });
});

describe("aiResponseSchema", () => {
  it("accepts a well formed response", () => {
    const parsed = aiResponseSchema.safeParse({
      summary: "問題ありません。",
      findings: [
        {
          severity: "warning",
          category: "profitability",
          title: "粗利率が低めです",
          description: "粗利率は12.0%です。",
          recommendedAction: "原価を確認してください。",
          itemName: null,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown severity", () => {
    const parsed = aiResponseSchema.safeParse({
      summary: "",
      findings: [
        {
          severity: "catastrophic",
          category: "profitability",
          title: "x",
          description: "y",
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non object payload", () => {
    expect(aiResponseSchema.safeParse(null).success).toBe(false);
    expect(aiResponseSchema.safeParse("見積は問題ありません").success).toBe(false);
    expect(aiResponseSchema.safeParse([]).success).toBe(false);
  });

  it("defaults missing optional fields", () => {
    const parsed = aiResponseSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.findings).toEqual([]);
      expect(parsed.data.summary).toBe("");
    }
  });

  it("rejects a findings list beyond the allowed size", () => {
    const finding = {
      severity: "info",
      category: "pricing",
      title: "t",
      description: "d",
      recommendedAction: "a",
      itemName: null,
    };
    const parsed = aiResponseSchema.safeParse({ summary: "", findings: Array(13).fill(finding) });
    expect(parsed.success).toBe(false);
  });
});
