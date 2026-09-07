"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { MonitorPlay } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, TextInput, describedBy } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { type LoginInput, loginSchema } from "@/lib/validation/auth";
import { demoLoginAction, loginAction } from "@/server/actions/auth";

const NETWORK_ERROR = "通信に失敗しました。時間をおいて再度お試しください。";

export function LoginForm({ next, demoAvailable }: { next?: string; demoAvailable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isDemoSubmitting, startDemoTransition] = React.useTransition();
  const demoSubmitLock = React.useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (isDemoSubmitting) return;
    setFormError(null);
    try {
      const result = await loginAction(values, next);
      if (!result.ok) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("ログインしました。");
      router.replace(result.data.redirectTo);
      router.refresh();
    } catch {
      setFormError(NETWORK_ERROR);
      toast.error(NETWORK_ERROR);
    }
  });

  const onDemoLogin = () => {
    if (!demoAvailable || demoSubmitLock.current || isDemoSubmitting || isSubmitting) return;

    demoSubmitLock.current = true;
    setFormError(null);
    startDemoTransition(async () => {
      try {
        const result = await demoLoginAction();
        if (!result.ok) {
          setFormError(result.error);
          toast.error(result.error);
          return;
        }
        toast.success("デモ環境にログインしました。");
        router.replace(result.data.redirectTo);
        router.refresh();
      } catch {
        setFormError(NETWORK_ERROR);
        toast.error(NETWORK_ERROR);
      } finally {
        demoSubmitLock.current = false;
      }
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <Field id="email" label="メールアドレス" required error={errors.email?.message}>
        <TextInput
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          disabled={isDemoSubmitting}
          invalid={Boolean(errors.email)}
          aria-describedby={describedBy("email", false, errors.email)}
          {...register("email")}
        />
      </Field>

      <Field id="password" label="パスワード" required error={errors.password?.message}>
        <TextInput
          id="password"
          type="password"
          autoComplete="current-password"
          disabled={isDemoSubmitting}
          invalid={Boolean(errors.password)}
          aria-describedby={describedBy("password", false, errors.password)}
          {...register("password")}
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        loading={isSubmitting}
        disabled={isDemoSubmitting}
        className="mt-1 w-full"
      >
        {isSubmitting ? "ログインしています…" : "ログイン"}
      </Button>

      <div className="flex items-center gap-3 py-1" role="separator" aria-label="その他のログイン方法">
        <span className="h-px flex-1 bg-steel-200" />
        <span className="text-xs text-ink-muted">または</span>
        <span className="h-px flex-1 bg-steel-200" />
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          loading={isDemoSubmitting}
          disabled={!demoAvailable || isSubmitting}
          onClick={onDemoLogin}
          className="w-full"
        >
          {!isDemoSubmitting ? <MonitorPlay aria-hidden className="size-5" /> : null}
          {isDemoSubmitting ? "デモ環境を準備しています…" : "デモ環境を見る"}
        </Button>
        <p className="text-center text-xs leading-relaxed text-ink-muted" aria-live="polite">
          {demoAvailable
            ? "登録不要・1クリックで架空のサンプル環境を確認できます。"
            : "デモ環境は現在利用できません。通常ログインをご利用ください。"}
        </p>
      </div>
    </form>
  );
}
