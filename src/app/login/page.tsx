import type { Metadata } from "next";

import Link from "next/link";

import { AuthShell } from "@/components/layout/auth-shell";
import { LoginForm } from "@/app/login/login-form";
import { isDemoLoginConfigured } from "@/server/demo";

export const metadata: Metadata = { title: "ログイン" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const demoAvailable = isDemoLoginConfigured();

  return (
    <AuthShell
      title="ログイン"
      description="登録済みのメールアドレスとパスワードを入力してください。"
      footer={
        <>
          アカウントをお持ちでない場合は{" "}
          <Link href="/signup" className="font-medium text-amber-300 underline underline-offset-2">
            新規登録
          </Link>
        </>
      }
    >
      <LoginForm next={next} demoAvailable={demoAvailable} />
    </AuthShell>
  );
}
