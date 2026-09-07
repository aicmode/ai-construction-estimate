import { z } from "zod";

import {
  optionalEmail,
  optionalPhone,
  optionalPostalCode,
  optionalText,
  requiredText,
} from "@/lib/validation/common";

export const customerSchema = z.object({
  name: requiredText(120, "顧客名"),
  companyName: optionalText(120, "法人名"),
  contactName: optionalText(80, "担当者名"),
  phone: optionalPhone,
  email: optionalEmail,
  postalCode: optionalPostalCode,
  address: optionalText(200, "住所"),
  notes: optionalText(2000, "備考"),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type CustomerFormValues = z.input<typeof customerSchema>;

export const customerFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
});
