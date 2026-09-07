/**
 * Money helpers.
 *
 * Every monetary value in this system is a whole Japanese yen amount held in a
 * JavaScript `number` that is guaranteed to be a safe integer, and in a
 * PostgreSQL `bigint` column. No floating point arithmetic is ever applied to
 * money: products and percentages go through `BigInt` so that values such as
 * `0.1 + 0.2` can never leak into an invoice.
 */

/** Upper bound for a single monetary field: 1 兆円. */
export const MAX_MONEY = 1_000_000_000_000;
/** Quantities are stored as numeric(14,3) — three decimal places. */
export const QUANTITY_SCALE = 1000;
export const MAX_QUANTITY = 1_000_000;
/** Unit prices/costs are capped well below MAX_MONEY to keep products safe. */
export const MAX_UNIT_PRICE = 100_000_000;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

function assertSafe(value: bigint, what: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(-Number.MAX_SAFE_INTEGER)) {
    throw new MoneyError(`${what} の計算結果が扱える金額の範囲を超えました。`);
  }
  return Number(value);
}

/**
 * Converts a possibly-fractional quantity into an exact integer number of
 * thousandths. Rejects values that are not finite so bad input never reaches
 * the arithmetic below.
 */
export function toQuantityMilli(quantity: number): bigint {
  if (!Number.isFinite(quantity)) {
    throw new MoneyError("数量が数値ではありません。");
  }
  if (quantity < 0) {
    throw new MoneyError("数量に負の値は指定できません。");
  }
  if (quantity > MAX_QUANTITY) {
    throw new MoneyError("数量が上限を超えています。");
  }
  // `Math.round` on a value already limited to 1e6 * 1e3 stays exact.
  return BigInt(Math.round(quantity * QUANTITY_SCALE));
}

export function assertIntegerYen(value: number, what: string): bigint {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new MoneyError(`${what} は円単位の整数で入力してください。`);
  }
  if (Math.abs(value) > MAX_MONEY) {
    throw new MoneyError(`${what} が上限を超えています。`);
  }
  return BigInt(value);
}

/**
 * quantity × unitPrice, rounded half-up to the nearest yen.
 * The multiplication happens in BigInt space, so no precision is lost.
 */
export function multiplyQuantity(quantity: number, unitAmount: number, what = "金額"): number {
  const q = toQuantityMilli(quantity);
  const u = assertIntegerYen(unitAmount, what);
  if (u < 0n) {
    throw new MoneyError(`${what} に負の値は指定できません。`);
  }
  const scaled = q * u; // yen × 1000
  const rounded = (scaled + BigInt(QUANTITY_SCALE / 2)) / BigInt(QUANTITY_SCALE);
  return assertSafe(rounded, what);
}

/**
 * Consumption tax on a tax-exclusive base.
 *
 * `taxRatePercent` may carry two decimals (e.g. 8.00 / 10.00). It is converted
 * to integer basis points before use. Japanese invoicing convention rounds the
 * tax down (切り捨て) at the document level, which is what we do here.
 */
export function calcTax(taxableAmount: number, taxRatePercent: number): number {
  const base = assertIntegerYen(taxableAmount, "税抜金額");
  if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100) {
    throw new MoneyError("消費税率が不正です。");
  }
  const basisPoints = BigInt(Math.round(taxRatePercent * 100)); // 10.00% -> 1000
  if (base <= 0n) return 0;
  return assertSafe((base * basisPoints) / 10_000n, "消費税");
}

export function sumYen(values: readonly number[], what = "合計"): number {
  let total = 0n;
  for (const value of values) {
    total += assertIntegerYen(value, what);
  }
  return assertSafe(total, what);
}

/**
 * Gross margin as a ratio (0.2345 = 23.45%). Returns 0 when the revenue base is
 * zero or negative so the UI never has to render NaN/Infinity.
 */
export function marginRate(grossProfit: number, revenue: number): number {
  if (!Number.isFinite(grossProfit) || !Number.isFinite(revenue)) return 0;
  if (revenue <= 0) return 0;
  return Math.round((grossProfit / revenue) * 10_000) / 10_000;
}

const YEN_FORMATTER = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });

export function formatYen(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "¥0";
  return `¥${YEN_FORMATTER.format(Math.trunc(value))}`;
}

export function formatYenPlain(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "0";
  return YEN_FORMATTER.format(Math.trunc(value));
}

export function formatPercent(rate: number | null | undefined, digits = 1): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return "0.0%";
  return `${(rate * 100).toFixed(digits)}%`;
}

const QUANTITY_FORMATTER = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 3 });

export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "0";
  return QUANTITY_FORMATTER.format(value);
}
