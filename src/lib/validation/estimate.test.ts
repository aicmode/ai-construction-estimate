import { describe, expect, it } from "vitest";

import { estimateSchema, estimateItemSchema, estimateListFilterSchema } from "@/lib/validation/estimate";

const VALID_ITEM = {
  name: "システムキッチン交換",
  category: "equipment",
  description: "既存撤去を含む",
  quantity: 1,
  unit: "set",
  unitPrice: 800_000,
  unitCost: 560_000,
};

const VALID_ESTIMATE = {
  title: "キッチン改修工事",
  customerId: "11111111-1111-4111-8111-111111111111",
  projectId: "",
  issueDate: "2026-05-01",
  validUntil: "2026-06-01",
  status: "DRAFT",
  taxRate: 10,
  discountAmount: 0,
  paymentTerms: "",
  notes: "",
  items: [VALID_ITEM],
};

describe("estimateSchema", () => {
  it("accepts a well formed estimate", () => {
    const parsed = estimateSchema.safeParse(VALID_ESTIMATE);
    expect(parsed.success).toBe(true);
  });

  /**
   * The payload the client sends carries only the values a human typed. Any
   * monetary total it tries to smuggle in must be discarded, because the server
   * recomputes every amount from quantity and unit rates.
   */
  it("strips client supplied monetary totals", () => {
    const parsed = estimateSchema.parse({
      ...VALID_ESTIMATE,
      totalAmount: 1,
      subtotalAmount: 1,
      taxAmount: 0,
      grossProfit: 999_999,
      grossMarginRate: 0.99,
      itemsSubtotal: 1,
      costAmount: 0,
      estimateNumber: "EST-9999-9999",
      organizationId: "22222222-2222-4222-8222-222222222222",
      deletedAt: null,
      items: [{ ...VALID_ITEM, amount: 1, costAmount: 0, sortOrder: 99, organizationId: "x" }],
    });

    for (const key of [
      "totalAmount",
      "subtotalAmount",
      "taxAmount",
      "grossProfit",
      "grossMarginRate",
      "itemsSubtotal",
      "costAmount",
      "estimateNumber",
      "organizationId",
      "deletedAt",
    ]) {
      expect(parsed).not.toHaveProperty(key);
    }
    expect(parsed.items[0]).not.toHaveProperty("amount");
    expect(parsed.items[0]).not.toHaveProperty("costAmount");
    expect(parsed.items[0]).not.toHaveProperty("organizationId");
  });

  it("requires at least one line item", () => {
    const parsed = estimateSchema.safeParse({ ...VALID_ESTIMATE, items: [] });
    expect(parsed.success).toBe(false);
  });

  it("rejects more than 200 line items", () => {
    const parsed = estimateSchema.safeParse({
      ...VALID_ESTIMATE,
      items: Array.from({ length: 201 }, () => VALID_ITEM),
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a validity date before the issue date", () => {
    const parsed = estimateSchema.safeParse({
      ...VALID_ESTIMATE,
      issueDate: "2026-05-01",
      validUntil: "2026-04-01",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].path).toEqual(["validUntil"]);
    }
  });

  it("normalises an empty projectId to null", () => {
    expect(estimateSchema.parse(VALID_ESTIMATE).projectId).toBeNull();
    expect(estimateSchema.parse({ ...VALID_ESTIMATE, validUntil: "" }).validUntil).toBeNull();
  });

  it("rejects an unknown status or unit", () => {
    expect(estimateSchema.safeParse({ ...VALID_ESTIMATE, status: "PAID" }).success).toBe(false);
    expect(
      estimateSchema.safeParse({ ...VALID_ESTIMATE, items: [{ ...VALID_ITEM, unit: "tons" }] })
        .success,
    ).toBe(false);
  });

  it("rejects a non integer or negative amount of money", () => {
    expect(
      estimateSchema.safeParse({ ...VALID_ESTIMATE, items: [{ ...VALID_ITEM, unitPrice: 1.5 }] })
        .success,
    ).toBe(false);
    expect(
      estimateSchema.safeParse({ ...VALID_ESTIMATE, items: [{ ...VALID_ITEM, unitCost: -1 }] })
        .success,
    ).toBe(false);
    expect(estimateSchema.safeParse({ ...VALID_ESTIMATE, discountAmount: -1 }).success).toBe(false);
  });

  it("rejects a quantity with more than three decimals", () => {
    expect(
      estimateSchema.safeParse({ ...VALID_ESTIMATE, items: [{ ...VALID_ITEM, quantity: 1.00005 }] })
        .success,
    ).toBe(false);
  });

  it("rejects an out of range tax rate", () => {
    expect(estimateSchema.safeParse({ ...VALID_ESTIMATE, taxRate: -1 }).success).toBe(false);
    expect(estimateSchema.safeParse({ ...VALID_ESTIMATE, taxRate: 101 }).success).toBe(false);
  });

  it("rejects a malformed customer id", () => {
    expect(estimateSchema.safeParse({ ...VALID_ESTIMATE, customerId: "1 OR 1=1" }).success).toBe(false);
    expect(estimateSchema.safeParse({ ...VALID_ESTIMATE, customerId: "" }).success).toBe(false);
  });

  it("trims whitespace and enforces the title length", () => {
    expect(estimateSchema.parse({ ...VALID_ESTIMATE, title: "  改修工事  " }).title).toBe("改修工事");
    expect(estimateSchema.safeParse({ ...VALID_ESTIMATE, title: "   " }).success).toBe(false);
    expect(estimateSchema.safeParse({ ...VALID_ESTIMATE, title: "あ".repeat(161) }).success).toBe(false);
  });
});

describe("estimateItemSchema", () => {
  it("requires a name", () => {
    expect(estimateItemSchema.safeParse({ ...VALID_ITEM, name: "" }).success).toBe(false);
  });

  it("allows a zero quantity so a draft row can be saved", () => {
    expect(estimateItemSchema.safeParse({ ...VALID_ITEM, quantity: 0 }).success).toBe(true);
  });
});

describe("estimateListFilterSchema", () => {
  it("drops unknown query parameters", () => {
    const parsed = estimateListFilterSchema.parse({ q: "外壁", evil: "DROP TABLE estimates" });
    expect(parsed).not.toHaveProperty("evil");
    expect(parsed.q).toBe("外壁");
  });

  it("rejects a malformed status or date", () => {
    expect(estimateListFilterSchema.safeParse({ status: "HACKED" }).success).toBe(false);
    expect(estimateListFilterSchema.safeParse({ from: "yesterday" }).success).toBe(false);
  });
});
