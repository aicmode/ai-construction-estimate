import { z } from "zod";

/**
 * Shared field primitives. Every user-supplied string is trimmed and length
 * limited before it reaches PostgreSQL, which keeps the CHECK constraints in
 * migration 0001 from ever being the first line of defence.
 */

export const requiredText = (max: number, label: string) =>
  z
    .string({ error: `${label}を入力してください。` })
    .trim()
    .min(1, `${label}を入力してください。`)
    .max(max, `${label}は${max}文字以内で入力してください。`);

export const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}は${max}文字以内で入力してください。`)
    .default("");

export const optionalEmail = z
  .union([z.literal(""), z.email("メールアドレスの形式が正しくありません。")])
  .default("");

export const optionalPhone = z
  .string()
  .trim()
  .max(24, "電話番号は24文字以内で入力してください。")
  .regex(/^[0-9+\-() 　]*$/u, "電話番号は数字と記号のみで入力してください。")
  .default("");

export const optionalPostalCode = z
  .string()
  .trim()
  .max(8, "郵便番号は8文字以内で入力してください。")
  .regex(/^(\d{3}-?\d{4})?$/u, "郵便番号は 123-4567 の形式で入力してください。")
  .default("");

export const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "日付は YYYY-MM-DD 形式で入力してください。")
  .refine((value) => !Number.isNaN(Date.parse(value)), "存在しない日付です。");

/**
 * An optional date.
 *
 * These schemas are parsed twice for the same submission: react-hook-form runs
 * them in the browser and hands the *transformed* values to the server action,
 * which validates again before touching the database. The empty branch
 * therefore has to accept `null` as well as `""` — otherwise the second parse
 * rejects the output the first parse produced.
 */
export const optionalIsoDate = z
  .union([z.literal(""), z.null(), isoDate])
  .default("")
  .transform((value) => (value === "" || value === null ? null : value));

export const uuid = z.uuid("IDの形式が正しくありません。");

/** Optional id. Accepts `null` for the same round-trip reason as `optionalIsoDate`. */
export const optionalUuid = z
  .union([z.literal(""), z.null(), uuid])
  .default("")
  .transform((value) => (value === "" || value === null ? null : value));

/** Whole yen. Rejects fractions, NaN and values outside the supported range. */
export const yenAmount = (label: string, max = 100_000_000_000) =>
  z
    .number({ error: `${label}を数値で入力してください。` })
    .int(`${label}は円単位の整数で入力してください。`)
    .min(0, `${label}は0以上で入力してください。`)
    .max(max, `${label}が上限を超えています。`);

/** numeric(14,3) — three decimal places at most. */
export const quantity = z
  .number({ error: "数量を数値で入力してください。" })
  .min(0, "数量は0以上で入力してください。")
  .max(1_000_000, "数量が上限を超えています。")
  .refine(
    (value) => Number.isInteger(Math.round(value * 1000)) && Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6,
    "数量は小数点以下3桁までで入力してください。",
  );

export const taxRate = z
  .number({ error: "消費税率を数値で入力してください。" })
  .min(0, "消費税率は0以上で入力してください。")
  .max(100, "消費税率は100以下で入力してください。")
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    "消費税率は小数点以下2桁までで入力してください。",
  );
