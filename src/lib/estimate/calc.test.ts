import { describe, expect, it } from "vitest";

import { calcEstimate, calcItem, tryCalcEstimate } from "@/lib/estimate/calc";
import {
  MoneyError,
  calcTax,
  formatPercent,
  formatYen,
  marginRate,
  multiplyQuantity,
  sumYen,
} from "@/lib/money";

describe("multiplyQuantity", () => {
  it("multiplies whole quantities exactly", () => {
    expect(multiplyQuantity(3, 12_000)).toBe(36_000);
  });

  it("handles fractional quantities without floating point drift", () => {
    // 0.1 + 0.2 style drift would produce 4200.000000000001 in plain JS.
    expect(multiplyQuantity(1.2, 3_500)).toBe(4_200);
    expect(multiplyQuantity(0.3, 100)).toBe(30);
    expect(multiplyQuantity(12.345, 1_000)).toBe(12_345);
  });

  it("rounds halves up to the nearest yen", () => {
    expect(multiplyQuantity(0.5, 2_001)).toBe(1_001); // 1000.5 -> 1001
    expect(multiplyQuantity(1.005, 1_000)).toBe(1_005);
  });

  it("returns zero when either factor is zero", () => {
    expect(multiplyQuantity(0, 98_000)).toBe(0);
    expect(multiplyQuantity(24, 0)).toBe(0);
  });

  it("rejects negative and non finite input", () => {
    expect(() => multiplyQuantity(-1, 100)).toThrow(MoneyError);
    expect(() => multiplyQuantity(1, -100)).toThrow(MoneyError);
    expect(() => multiplyQuantity(Number.NaN, 100)).toThrow(MoneyError);
    expect(() => multiplyQuantity(Number.POSITIVE_INFINITY, 100)).toThrow(MoneyError);
  });

  it("rejects non integer unit prices", () => {
    expect(() => multiplyQuantity(1, 100.5)).toThrow(MoneyError);
  });

  it("rejects quantities beyond the supported range", () => {
    expect(() => multiplyQuantity(1_000_001, 1)).toThrow(MoneyError);
  });
});

describe("calcTax", () => {
  it("applies the standard 10% rate with truncation", () => {
    expect(calcTax(1_000_000, 10)).toBe(100_000);
    expect(calcTax(9_999, 10)).toBe(999); // 999.9 -> 999
  });

  it("supports the reduced 8% rate", () => {
    expect(calcTax(12_345, 8)).toBe(987); // 987.6 -> 987
  });

  it("supports fractional rates", () => {
    expect(calcTax(10_000, 7.5)).toBe(750);
  });

  it("returns zero for a zero rate or a non positive base", () => {
    expect(calcTax(500_000, 0)).toBe(0);
    expect(calcTax(0, 10)).toBe(0);
    expect(calcTax(-100, 10)).toBe(0);
  });

  it("rejects out of range rates", () => {
    expect(() => calcTax(1000, -1)).toThrow(MoneyError);
    expect(() => calcTax(1000, 101)).toThrow(MoneyError);
    expect(() => calcTax(1000, Number.NaN)).toThrow(MoneyError);
  });
});

describe("marginRate", () => {
  it("computes a ratio rounded to four decimals", () => {
    expect(marginRate(250_000, 1_000_000)).toBe(0.25);
    expect(marginRate(1, 3)).toBe(0.3333);
  });

  it("guards against division by zero", () => {
    expect(marginRate(100, 0)).toBe(0);
    expect(marginRate(0, 0)).toBe(0);
    expect(marginRate(-100, -100)).toBe(0);
  });

  it("can be negative when the job loses money", () => {
    expect(marginRate(-200_000, 1_000_000)).toBe(-0.2);
  });
});

describe("sumYen", () => {
  it("sums integers exactly", () => {
    expect(sumYen([1, 2, 3])).toBe(6);
    expect(sumYen([])).toBe(0);
  });

  it("rejects fractional yen", () => {
    expect(() => sumYen([1.5])).toThrow(MoneyError);
  });
});

describe("calcItem", () => {
  it("derives both the sales amount and the cost amount", () => {
    expect(calcItem({ quantity: 24.5, unitPrice: 4_800, unitCost: 3_200 })).toEqual({
      amount: 117_600,
      costAmount: 78_400,
    });
  });
});

describe("calcEstimate", () => {
  const items = [
    // 1式 × 780,000 = 780,000 (cost 520,000)
    { quantity: 1, unitPrice: 780_000, unitCost: 520_000 },
    // 24.5㎡ × 4,800 = 117,600 (cost 78,400)
    { quantity: 24.5, unitPrice: 4_800, unitCost: 3_200 },
    // 2台 × 65,000 = 130,000 (cost 48,000)
    { quantity: 2, unitPrice: 65_000, unitCost: 24_000 },
  ];

  it("computes the full money breakdown", () => {
    const result = calcEstimate({ items, taxRate: 10, discountAmount: 27_600 });

    expect(result.itemsSubtotal).toBe(1_027_600);
    expect(result.costAmount).toBe(646_400);
    expect(result.discountAmount).toBe(27_600);
    expect(result.subtotalAmount).toBe(1_000_000);
    expect(result.taxAmount).toBe(100_000);
    expect(result.totalAmount).toBe(1_100_000);
    expect(result.grossProfit).toBe(353_600);
    expect(result.grossMarginRate).toBe(0.3536);
  });

  it("keeps the discount out of the tax base only once", () => {
    const noDiscount = calcEstimate({ items, taxRate: 10, discountAmount: 0 });
    expect(noDiscount.subtotalAmount).toBe(1_027_600);
    expect(noDiscount.taxAmount).toBe(102_760);
    expect(noDiscount.totalAmount).toBe(1_130_360);
  });

  it("handles an empty estimate without dividing by zero", () => {
    const result = calcEstimate({ items: [], taxRate: 10, discountAmount: 0 });
    expect(result).toMatchObject({
      itemsSubtotal: 0,
      subtotalAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
      costAmount: 0,
      grossProfit: 0,
      grossMarginRate: 0,
    });
  });

  it("reports a negative gross profit when cost exceeds price", () => {
    const result = calcEstimate({
      items: [{ quantity: 1, unitPrice: 100_000, unitCost: 130_000 }],
      taxRate: 10,
      discountAmount: 0,
    });
    expect(result.grossProfit).toBe(-30_000);
    expect(result.grossMarginRate).toBe(-0.3);
  });

  it("rejects a discount larger than the items subtotal", () => {
    expect(() =>
      calcEstimate({ items, taxRate: 10, discountAmount: 2_000_000 }),
    ).toThrow(MoneyError);
  });

  it("rejects a fractional or negative discount", () => {
    expect(() => calcEstimate({ items, taxRate: 10, discountAmount: 1.5 })).toThrow(MoneyError);
    expect(() => calcEstimate({ items, taxRate: 10, discountAmount: -1 })).toThrow(MoneyError);
  });

  it("allows a discount that zeroes the estimate", () => {
    const result = calcEstimate({
      items: [{ quantity: 1, unitPrice: 50_000, unitCost: 30_000 }],
      taxRate: 10,
      discountAmount: 50_000,
    });
    expect(result.subtotalAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
    expect(result.grossProfit).toBe(-30_000);
    expect(result.grossMarginRate).toBe(0);
  });
});

describe("tryCalcEstimate", () => {
  it("returns a failure result instead of throwing", () => {
    const result = tryCalcEstimate({
      items: [{ quantity: -1, unitPrice: 1, unitCost: 1 }],
      taxRate: 10,
      discountAmount: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("数量");
  });

  it("returns the computed value on success", () => {
    const result = tryCalcEstimate({
      items: [{ quantity: 2, unitPrice: 1_000, unitCost: 600 }],
      taxRate: 10,
      discountAmount: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.totalAmount).toBe(2_200);
  });
});

describe("formatters", () => {
  it("formats yen for Japanese business documents", () => {
    expect(formatYen(1_234_567)).toBe("¥1,234,567");
    expect(formatYen(0)).toBe("¥0");
    expect(formatYen(null)).toBe("¥0");
    expect(formatYen(Number.NaN)).toBe("¥0");
  });

  it("formats margin rates", () => {
    expect(formatPercent(0.3536)).toBe("35.4%");
    expect(formatPercent(null)).toBe("0.0%");
  });
});
