import type { Metadata } from "next";

import Link from "next/link";

import { AuthShell } from "@/components/layout/auth-shell";
import { SignupForm } from "@/app/signup/signup-form";

export const metadata: Metadata = { title: "新規登録" };

export default function SignupPage() {
  return (
    <AuthShell
      title="新規登録"
      description="アカウントを作成すると、続けて組織（自社）の登録に進みます。"
      footer={
        <>
          すでにアカウントをお持ちの場合は{" "}
          <Link href="/login" className="font-medium text-amber-300 underline underline-offset-2">
            ログイン
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
