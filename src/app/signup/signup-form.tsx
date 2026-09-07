"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, TextInput, describedBy } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { type SignupInput, signupSchema } from "@/lib/validation/auth";
import { signupAction } from "@/server/actions/auth";

export function SignupForm() {
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmSent, setConfirmSent] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await signupAction(values);
    if (!result.ok) {
      setFormError(result.error);
      toast.error(result.error);
      return;
    }

    if (result.data.needsEmailConfirm) {
      setConfirmSent(true);
      toast.success("確認メールを送信しました。");
      return;
    }

    toast.success("アカウントを作成しました。");
    router.replace("/onboarding");
    router.refresh();
  });

  if (confirmSent) {
    return (
      <div role="status" className="rounded-md border border-steel-200 bg-steel-50 px-4 py-4 text-sm text-ink-soft">
        <p className="font-medium text-ink">確認メールを送信しました</p>
        <p className="mt-1 leading-relaxed">
          メール内のリンクを開いてアカウントを有効化したあと、ログインしてください。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <Field id="displayName" label="お名前" required error={errors.displayName?.message}>
        <TextInput
          id="displayName"
          autoComplete="name"
          placeholder="見積 太郎"
          invalid={Boolean(errors.displayName)}
          aria-describedby={describedBy("displayName", false, errors.displayName)}
          {...register("displayName")}
        />
      </Field>

      <Field id="email" label="メールアドレス" required error={errors.email?.message}>
        <TextInput
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          invalid={Boolean(errors.email)}
          aria-describedby={describedBy("email", false, errors.email)}
          {...register("email")}
        />
      </Field>

      <Field
        id="password"
        label="パスワード"
        required
        hint="8文字以上で設定してください。"
        error={errors.password?.message}
      >
        <TextInput
          id="password"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(errors.password)}
          aria-describedby={describedBy("password", true, errors.password)}
          {...register("password")}
        />
      </Field>

      <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? "作成しています…" : "アカウントを作成"}
      </Button>
    </form>
  );
}
