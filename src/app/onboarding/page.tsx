import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { AuthShell } from "@/components/layout/auth-shell";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { getMemberships, requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "組織の作成" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await requireUser();

  // Somebody who already belongs to an organization has nothing to do here.
  const memberships = await getMemberships();
  if (memberships.length > 0) redirect("/dashboard");

  return (
    <AuthShell
      title="組織を作成"
      description="自社の情報を登録すると、見積管理を開始できます。"
    >
      <OnboardingForm />
    </AuthShell>
  );
}
