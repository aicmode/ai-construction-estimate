import {
  MoneyError,
  calcTax,
  marginRate,
  multiplyQuantity,
  sumYen,
} from "@/lib/money";

/**
 * The minimum shape the calculator needs from a line item. Anything that can
 * describe a quantity and two unit rates can be costed — the editor form, a
 * server action payload and a database row all satisfy it.
 */
export interface CalcItemInput {
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

export interface CalcItemResult {
  /** quantity × unitPrice, rounded to whole yen. */
  amount: number;
  /** quantity × unitCost, rounded to whole yen. */
  costAmount: number;
}

export interface CalcEstimateInput {
  items: readonly CalcItemInput[];
  /** Percent with up to two decimals, e.g. 10 or 8.  */
  taxRate: number;
  /** Tax-exclusive discount in whole yen. */
  discountAmount: number;
}

export interface CalcEstimateResult {
  items: CalcItemResult[];
  /** Σ item.amount — before discount. */
  itemsSubtotal: number;
  /** Discount actually applied (never more than the items subtotal). */
  discountAmount: number;
  /** Tax-exclusive total after discount. */
  subtotalAmount: number;
  taxAmount: number;
  /** Tax-inclusive grand total. */
  totalAmount: number;
  /** Σ item.costAmount. */
  costAmount: number;
  /** subtotalAmount − costAmount. */
  grossProfit: number;
  /** grossProfit ÷ subtotalAmount, 0 when the subtotal is not positive. */
  grossMarginRate: number;
}

export function calcItem(item: CalcItemInput): CalcItemResult {
  return {
    amount: multiplyQuantity(item.quantity, item.unitPrice, "金額"),
    costAmount: multiplyQuantity(item.quantity, item.unitCost, "原価"),
  };
}

/**
 * Single source of truth for estimate money.
 *
 * The client uses it to render live totals while the user types; the server
 * calls the very same function before writing to the database, so a tampered
 * payload cannot change what is stored. Totals sent by the client are never
 * persisted.
 */
export function calcEstimate(input: CalcEstimateInput): CalcEstimateResult {
  const items = input.items.map(calcItem);

  const itemsSubtotal = sumYen(
    items.map((item) => item.amount),
    "明細合計",
  );
  const costAmount = sumYen(
    items.map((item) => item.costAmount),
    "原価合計",
  );

  if (!Number.isInteger(input.discountAmount) || input.discountAmount < 0) {
    throw new MoneyError("値引き額は0以上の整数で入力してください。");
  }
  if (input.discountAmount > itemsSubtotal) {
    throw new MoneyError("値引き額が明細合計を超えています。");
  }

  const discountAmount = input.discountAmount;
  const subtotalAmount = itemsSubtotal - discountAmount;
  const taxAmount = calcTax(subtotalAmount, input.taxRate);
  const totalAmount = subtotalAmount + taxAmount;
  const grossProfit = subtotalAmount - costAmount;

  return {
    items,
    itemsSubtotal,
    discountAmount,
    subtotalAmount,
    taxAmount,
    totalAmount,
    costAmount,
    grossProfit,
    grossMarginRate: marginRate(grossProfit, subtotalAmount),
  };
}

/**
 * Non-throwing variant for live UI feedback: while a user is mid-edit the form
 * regularly holds temporarily invalid numbers, and a thrown error there would
 * blank the screen.
 */
export function tryCalcEstimate(
  input: CalcEstimateInput,
): { ok: true; value: CalcEstimateResult } | { ok: false; message: string } {
  try {
    return { ok: true, value: calcEstimate(input) };
  } catch (error) {
    if (error instanceof MoneyError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "金額を計算できませんでした。入力値を確認してください。" };
  }
}
