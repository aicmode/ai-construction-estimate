import { z } from "zod";

import { PROJECT_STATUSES, WORK_TYPES } from "@/lib/domain";
import {
  optionalIsoDate,
  optionalText,
  requiredText,
  uuid,
} from "@/lib/validation/common";

export const projectSchema = z
  .object({
    name: requiredText(160, "案件名"),
    customerId: uuid,
    workType: z.enum(WORK_TYPES, { error: "工事種別を選択してください。" }),
    siteAddress: optionalText(200, "施工場所"),
    description: optionalText(2000, "工事概要"),
    scheduledStartDate: optionalIsoDate,
    scheduledEndDate: optionalIsoDate,
    managerName: optionalText(80, "担当者"),
    status: z.enum(PROJECT_STATUSES, { error: "ステータスを選択してください。" }),
    notes: optionalText(2000, "備考"),
  })
  .refine(
    (value) =>
      !value.scheduledStartDate ||
      !value.scheduledEndDate ||
      value.scheduledEndDate >= value.scheduledStartDate,
    {
      message: "完了予定日は着工予定日以降の日付にしてください。",
      path: ["scheduledEndDate"],
    },
  );

export type ProjectInput = z.infer<typeof projectSchema>;
export type ProjectFormValues = z.input<typeof projectSchema>;
