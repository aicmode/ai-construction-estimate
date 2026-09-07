import { z } from "zod";

import {
  optionalEmail,
  optionalPhone,
  optionalPostalCode,
  optionalText,
  requiredText,
  taxRate,
} from "@/lib/validation/common";

export const companySettingsSchema = z.object({
  companyName: requiredText(120, "会社名"),
  postalCode: optionalPostalCode,
  address: optionalText(200, "住所"),
  phone: optionalPhone,
  email: optionalEmail,
  contactName: optionalText(80, "担当者名"),
  invoiceRegistrationNumber: z
    .string()
    .trim()
    .max(20, "登録番号は20文字以内で入力してください。")
    .regex(/^(T?\d{0,13})?$/u, "登録番号は「T」+13桁の数字で入力してください。")
    .default(""),
  bankAccount: optionalText(200, "振込先"),
  defaultTaxRate: taxRate,
  defaultValidityDays: z
    .number({ error: "見積有効期間を数値で入力してください。" })
    .int("見積有効期間は整数で入力してください。")
    .min(1, "見積有効期間は1日以上で入力してください。")
    .max(365, "見積有効期間は365日以内で入力してください。"),
  defaultPaymentTerms: optionalText(500, "支払条件"),
});

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
export type CompanySettingsFormValues = z.input<typeof companySettingsSchema>;
