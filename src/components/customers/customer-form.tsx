"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, TextInput, Textarea, describedBy } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  type CustomerFormValues,
  type CustomerInput,
  customerSchema,
} from "@/lib/validation/customer";
import type { ActionResult } from "@/server/actions/result";

export function CustomerForm({
  defaultValues,
  submitLabel,
  onSubmitAction,
  cancelHref,
}: {
  defaultValues: CustomerFormValues;
  submitLabel: string;
  onSubmitAction: (input: CustomerInput) => Promise<ActionResult<{ id: string }>>;
  cancelHref: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues, unknown, CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues,
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await onSubmitAction(values);

    if (!result.ok) {
      setFormError(result.error);
      // Re-apply server-side field errors so the same messages appear inline.
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (field in values) {
          setError(field as keyof CustomerFormValues, { message: messages[0] });
        }
      }
      toast.error(result.error);
      return;
    }

    toast.success(`${submitLabel}しました。`);
    router.push(`/customers/${result.data.id}`);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader title="顧客情報" description="顧客名のみ必須です。他の項目はあとから追加できます。" />
        <CardBody className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {formError ? (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-sm text-danger md:col-span-2"
            >
              {formError}
            </p>
          ) : null}

          <Field id="name" label="顧客名" required error={errors.name?.message}>
            <TextInput
              id="name"
              placeholder="架空 太郎"
              invalid={Boolean(errors.name)}
              aria-describedby={describedBy("name", false, errors.name)}
              {...register("name")}
            />
          </Field>

          <Field id="companyName" label="法人名" error={errors.companyName?.message}>
            <TextInput
              id="companyName"
              placeholder="サンプル不動産管理株式会社"
              invalid={Boolean(errors.companyName)}
              aria-describedby={describedBy("companyName", false, errors.companyName)}
              {...register("companyName")}
            />
          </Field>

          <Field id="contactName" label="担当者名" error={errors.contactName?.message}>
            <TextInput
              id="contactName"
              placeholder="設備部 サンプル"
              invalid={Boolean(errors.contactName)}
              aria-describedby={describedBy("contactName", false, errors.contactName)}
              {...register("contactName")}
            />
          </Field>

          <Field id="phone" label="電話番号" error={errors.phone?.message}>
            <TextInput
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder="03-0000-0000"
              invalid={Boolean(errors.phone)}
              aria-describedby={describedBy("phone", false, errors.phone)}
              {...register("phone")}
            />
          </Field>

          <Field id="email" label="メールアドレス" error={errors.email?.message}>
            <TextInput
              id="email"
              type="email"
              inputMode="email"
              placeholder="contact@example.jp"
              invalid={Boolean(errors.email)}
              aria-describedby={describedBy("email", false, errors.email)}
              {...register("email")}
            />
          </Field>

          <Field
            id="postalCode"
            label="郵便番号"
            hint="123-4567 の形式"
            error={errors.postalCode?.message}
          >
            <TextInput
              id="postalCode"
              inputMode="numeric"
              placeholder="150-0002"
              invalid={Boolean(errors.postalCode)}
              aria-describedby={describedBy("postalCode", true, errors.postalCode)}
              {...register("postalCode")}
            />
          </Field>

          <Field id="address" label="住所" className="md:col-span-2" error={errors.address?.message}>
            <TextInput
              id="address"
              placeholder="東京都渋谷区渋谷0-0-0 サンプルビル10階"
              invalid={Boolean(errors.address)}
              aria-describedby={describedBy("address", false, errors.address)}
              {...register("address")}
            />
          </Field>

          <Field id="notes" label="備考" className="md:col-span-2" error={errors.notes?.message}>
            <Textarea
              id="notes"
              rows={4}
              placeholder="現地調査時の注意点、担当者の連絡可能時間など"
              invalid={Boolean(errors.notes)}
              aria-describedby={describedBy("notes", false, errors.notes)}
              {...register("notes")}
            />
          </Field>
        </CardBody>
      </Card>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <LinkButton href={cancelHref} variant="secondary">
          キャンセル
        </LinkButton>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? "保存しています…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
