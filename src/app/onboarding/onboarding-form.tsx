"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, TextInput, describedBy } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  type OnboardingFormValues,
  type OnboardingInput,
  onboardingSchema,
} from "@/lib/validation/auth";
import { createOrganizationAction } from "@/server/actions/auth";

export function OnboardingForm() {
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    // Three generics: raw form values, context, parsed values. Zod defaults make
    // some inputs optional, so the submitted type differs from the field type.
  } = useForm<OnboardingFormValues, unknown, OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { organizationName: "", companyName: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await createOrganizationAction(values);
    if (!result.ok) {
      setFormError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("組織を作成しました。");
    router.replace("/dashboard");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <Field
        id="organizationName"
        label="組織名"
        required
        hint="顧客・案件・見積はこの組織単位で管理されます。"
        error={errors.organizationName?.message}
      >
        <TextInput
          id="organizationName"
          placeholder="サンプル建設工業株式会社"
          invalid={Boolean(errors.organizationName)}
          aria-describedby={describedBy("organizationName", true, errors.organizationName)}
          {...register("organizationName")}
        />
      </Field>

      <Field
        id="companyName"
        label="見積書に表示する会社名"
        hint="未入力の場合は組織名がそのまま使われます。あとから会社設定で変更できます。"
        error={errors.companyName?.message}
      >
        <TextInput
          id="companyName"
          placeholder="サンプル建設工業株式会社"
          invalid={Boolean(errors.companyName)}
          aria-describedby={describedBy("companyName", true, errors.companyName)}
          {...register("companyName")}
        />
      </Field>

      <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? "作成しています…" : "組織を作成して開始"}
      </Button>
    </form>
  );
}
