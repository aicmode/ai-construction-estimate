import { z } from "zod";

import { ESTIMATE_STATUSES, ITEM_CATEGORIES, UNIT_TYPES } from "@/lib/domain";
import { MAX_UNIT_PRICE } from "@/lib/money";
import {
  isoDate,
  optionalIsoDate,
  optionalText,
  optionalUuid,
  quantity,
  requiredText,
  taxRate,
  uuid,
  yenAmount,
} from "@/lib/validation/common";

export const estimateItemSchema = z.object({
  /** Present when editing an existing row; absent for newly added rows. */
  id: optionalUuid,
  name: requiredText(160, "工事項目名"),
  category: z.enum(ITEM_CATEGORIES, { error: "カテゴリを選択してください。" }),
  description: optionalText(500, "内容・摘要"),
  quantity,
  unit: z.enum(UNIT_TYPES, { error: "単位を選択してください。" }),
  unitPrice: yenAmount("販売単価", MAX_UNIT_PRICE),
  unitCost: yenAmount("原価単価", MAX_UNIT_PRICE),
});

export type EstimateItemInput = z.infer<typeof estimateItemSchema>;
export type EstimateItemFormValues = z.input<typeof estimateItemSchema>;

export const estimateSchema = z
  .object({
    title: requiredText(160, "見積タイトル"),
    customerId: uuid,
    projectId: optionalUuid,
    issueDate: isoDate,
    validUntil: optionalIsoDate,
    status: z.enum(ESTIMATE_STATUSES, { error: "ステータスを選択してください。" }),
    taxRate,
    discountAmount: yenAmount("値引き額"),
    paymentTerms: optionalText(500, "支払条件"),
    notes: optionalText(2000, "備考"),
    items: z
      .array(estimateItemSchema)
      .min(1, "見積明細を1行以上入力してください。")
      .max(200, "見積明細は200行までです。"),
  })
  .refine((value) => !value.validUntil || value.validUntil >= value.issueDate, {
    message: "有効期限は発行日以降の日付にしてください。",
    path: ["validUntil"],
  });

export type EstimateInput = z.infer<typeof estimateSchema>;
export type EstimateFormValues = z.input<typeof estimateSchema>;

export const estimateStatusChangeSchema = z.object({
  estimateId: uuid,
  status: z.enum(ESTIMATE_STATUSES, { error: "ステータスを選択してください。" }),
});

export const estimateListFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(ESTIMATE_STATUSES).optional(),
  customerId: z.uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
});

export type EstimateListFilter = z.infer<typeof estimateListFilterSchema>;
