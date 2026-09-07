"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, TextInput, Textarea, describedBy } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  type CompanySettingsFormValues,
  type CompanySettingsInput,
  companySettingsSchema,
} from "@/lib/validation/company";
import { saveCompanySettingsAction } from "@/server/actions/company";

export function CompanyForm({
  defaultValues,
  readOnly = false,
}: {
  defaultValues: CompanySettingsFormValues;
  /** Demo visitors may read the settings but not save them. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CompanySettingsFormValues, unknown, CompanySettingsInput>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues,
    // Form-level `disabled` marks every registered field read-only in one place,
    // rather than threading a flag through ~11 inputs.
    disabled: readOnly,
  });

  const onSubmit = handleSubmit(async (values) => {
    if (readOnly) return;
    setFormError(null);
    const result = await saveCompanySettingsAction(values);

    if (!result.ok) {
      setFormError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (field in values) {
          setError(field as keyof CompanySettingsFormValues, { message: messages[0] });
        }
      }
      toast.error(result.error);
      return;
    }

    toast.success("会社設定を保存しました。");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {formError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <Card>
        <CardHeader title="発行元情報" description="見積書PDFのヘッダーに印字されます。" />
        <CardBody className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            id="companyName"
            label="会社名"
            required
            className="md:col-span-2"
            error={errors.companyName?.message}
          >
            <TextInput
              id="companyName"
              placeholder="サンプル建設工業株式会社"
              invalid={Boolean(errors.companyName)}
              aria-describedby={describedBy("companyName", false, errors.companyName)}
              {...register("companyName")}
            />
          </Field>

          <Field id="postalCode" label="郵便番号" hint="123-4567 の形式" error={errors.postalCode?.message}>
            <TextInput
              id="postalCode"
              inputMode="numeric"
              placeholder="141-0001"
              invalid={Boolean(errors.postalCode)}
              aria-describedby={describedBy("postalCode", true, errors.postalCode)}
              {...register("postalCode")}
            />
          </Field>

          <Field id="phone" label="電話番号" error={errors.phone?.message}>
            <TextInput
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder="03-1234-5678"
              invalid={Boolean(errors.phone)}
              aria-describedby={describedBy("phone", false, errors.phone)}
              {...register("phone")}
            />
          </Field>

          <Field id="address" label="住所" className="md:col-span-2" error={errors.address?.message}>
            <TextInput
              id="address"
              placeholder="東京都品川区北品川0-0-0 サンプル第2ビル3階"
              invalid={Boolean(errors.address)}
              aria-describedby={describedBy("address", false, errors.address)}
              {...register("address")}
            />
          </Field>

          <Field id="email" label="メールアドレス" error={errors.email?.message}>
            <TextInput
              id="email"
              type="email"
              inputMode="email"
              placeholder="info@example.com"
              invalid={Boolean(errors.email)}
              aria-describedby={describedBy("email", false, errors.email)}
              {...register("email")}
            />
          </Field>

          <Field id="contactName" label="担当者名" error={errors.contactName?.message}>
            <TextInput
              id="contactName"
              placeholder="見積 花子"
              invalid={Boolean(errors.contactName)}
              aria-describedby={describedBy("contactName", false, errors.contactName)}
              {...register("contactName")}
            />
          </Field>

          <Field
            id="invoiceRegistrationNumber"
            label="インボイス登録番号"
            hint="「T」+ 13桁の数字（未取得の場合は空欄）"
            error={errors.invoiceRegistrationNumber?.message}
          >
            <TextInput
              id="invoiceRegistrationNumber"
              placeholder="T1234567890123"
              invalid={Boolean(errors.invoiceRegistrationNumber)}
              aria-describedby={describedBy(
                "invoiceRegistrationNumber",
                true,
                errors.invoiceRegistrationNumber,
              )}
              {...register("invoiceRegistrationNumber")}
            />
          </Field>

          <Field id="bankAccount" label="振込先" error={errors.bankAccount?.message}>
            <TextInput
              id="bankAccount"
              placeholder="サンプル銀行 品川支店 普通 0000000"
              invalid={Boolean(errors.bankAccount)}
              aria-describedby={describedBy("bankAccount", false, errors.bankAccount)}
              {...register("bankAccount")}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="見積の初期値" description="新規見積を作成するときの初期値として使われます。" />
        <CardBody className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            id="defaultTaxRate"
            label="消費税率（%）"
            required
            error={errors.defaultTaxRate?.message}
          >
            <TextInput
              id="defaultTaxRate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              inputMode="decimal"
              className="tabular"
              invalid={Boolean(errors.defaultTaxRate)}
              aria-describedby={describedBy("defaultTaxRate", false, errors.defaultTaxRate)}
              {...register("defaultTaxRate", { valueAsNumber: true })}
            />
          </Field>

          <Field
            id="defaultValidityDays"
            label="見積有効期間（日）"
            required
            hint="発行日からの日数。1〜365日。"
            error={errors.defaultValidityDays?.message}
          >
            <TextInput
              id="defaultValidityDays"
              type="number"
              step="1"
              min="1"
              max="365"
              inputMode="numeric"
              className="tabular"
              invalid={Boolean(errors.defaultValidityDays)}
              aria-describedby={describedBy("defaultValidityDays", true, errors.defaultValidityDays)}
              {...register("defaultValidityDays", { valueAsNumber: true })}
            />
          </Field>

          <Field
            id="defaultPaymentTerms"
            label="支払条件"
            className="md:col-span-2"
            error={errors.defaultPaymentTerms?.message}
          >
            <Textarea
              id="defaultPaymentTerms"
              rows={3}
              placeholder="着手時50%・完了引渡時50%（各請求書発行後30日以内のお振込み）"
              invalid={Boolean(errors.defaultPaymentTerms)}
              aria-describedby={describedBy("defaultPaymentTerms", false, errors.defaultPaymentTerms)}
              {...register("defaultPaymentTerms")}
            />
          </Field>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={readOnly}
          title={readOnly ? "デモ環境では保存できません" : undefined}
        >
          <Save aria-hidden className="size-4" />
          {isSubmitting ? "保存しています…" : "設定を保存"}
        </Button>
      </div>
    </form>
  );
}
