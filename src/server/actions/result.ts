import "server-only";

import type { ZodError } from "zod";

import { ConfigurationError } from "@/lib/env";
import { MoneyError } from "@/lib/money";

export type FieldErrors = Record<string, string[]>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function success(): ActionResult<undefined>;
export function success<T>(data: T): ActionResult<T>;
export function success<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function failure(error: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function fromZodError(error: ZodError): ActionResult<never> {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map((segment) => String(segment)).join(".") || "form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const first = error.issues[0]?.message ?? "入力内容を確認してください。";
  return { ok: false, error: first, fieldErrors };
}

/**
 * Converts an unexpected server error into a message that is safe to display.
 *
 * Raw driver errors can embed connection strings and request headers, so only
 * curated messages ever reach the browser. The original is logged server-side
 * where operators — not end users — can read it.
 */
export function fromUnknownError(error: unknown, fallback: string): ActionResult<never> {
  if (error instanceof MoneyError) return failure(error.message);
  if (error instanceof ConfigurationError) return failure(error.message);

  console.error("[action]", error instanceof Error ? error.message : error);
  return failure(fallback);
}

/** Maps the PostgreSQL error codes this app can legitimately hit. */
export function describeDatabaseError(
  error: { code?: string; message: string },
  fallback: string,
): string {
  switch (error.code) {
    case "23505":
      return "同じ内容のデータが既に登録されています。";
    case "23503":
      return "関連するデータが見つかりません。選択内容を確認してください。";
    case "23514":
      return "入力値がデータベースの制約に違反しています。内容を確認してください。";
    case "42501":
      return "この操作を行う権限がありません。";
    case "P0002":
      return "対象のデータが見つかりませんでした。";
    default:
      console.error("[db]", error.code ?? "unknown", error.message);
      return fallback;
  }
}
