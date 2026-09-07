"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loginSchema, onboardingSchema, signupSchema } from "@/lib/validation/auth";
import { ACTIVE_ORG_COOKIE, getMemberships } from "@/server/auth";
import { getDemoCredentials } from "@/server/demo";
import {
  type ActionResult,
  describeDatabaseError,
  failure,
  fromUnknownError,
  fromZodError,
  success,
} from "@/server/actions/result";

/** Only allow same-origin relative redirects, never an attacker supplied URL. */
function safeRedirectPath(value: string | undefined): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function loginAction(
  input: unknown,
  next?: string,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      // Deliberately generic so the form cannot be used to enumerate accounts.
      return failure("メールアドレスまたはパスワードが正しくありません。");
    }

    const memberships = await getMemberships();
    return success({
      redirectTo: memberships.length === 0 ? "/onboarding" : safeRedirectPath(next),
    });
  } catch (error) {
    return fromUnknownError(error, "ログイン処理に失敗しました。時間をおいて再度お試しください。");
  }
}

/**
 * Signs visitors into the shared demo through the same Supabase Auth and RLS
 * path as a normal user. Credentials never cross the Server Action boundary.
 */
export async function demoLoginAction(): Promise<ActionResult<{ redirectTo: string }>> {
  const credentials = getDemoCredentials();
  if (!credentials) {
    return failure("デモ環境は現在利用できません。時間をおいて再度お試しください。");
  }

  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword(credentials);

    if (
      authError ||
      !auth.user ||
      auth.user.email?.trim().toLowerCase() !== credentials.email.toLowerCase()
    ) {
      console.error("[demo-login] Supabase authentication failed");
      await supabase.auth.signOut();
      return failure("デモ環境にログインできませんでした。時間をおいて再度お試しください。");
    }

    // Resolve the organization through the authenticated user's membership.
    // This query is subject to the existing organization_members RLS policy.
    const { data: memberships, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id, organizations(id, name)")
      .order("created_at", { ascending: true })
      .limit(1);

    const membership = memberships?.[0];
    const organization = membership?.organizations as { id: string; name: string } | null | undefined;

    if (membershipError || !membership || !organization) {
      console.error("[demo-login] Demo organization membership is unavailable");
      await supabase.auth.signOut();
      const cookieStore = await cookies();
      cookieStore.delete(ACTIVE_ORG_COOKIE);
      return failure("デモ環境の準備が完了していません。時間をおいて再度お試しください。");
    }

    // A valid session without seeded business data would otherwise send the
    // visitor to an empty or partially configured dashboard. Check through the
    // same authenticated client so RLS remains in force.
    const demoDataChecks = await Promise.all([
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", membership.organization_id),
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", membership.organization_id),
      supabase
        .from("estimates")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", membership.organization_id),
      supabase
        .from("estimate_items")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", membership.organization_id),
    ]);

    if (demoDataChecks.some(({ count, error }) => error || !count)) {
      console.error("[demo-login] Seeded demo data is unavailable");
      await supabase.auth.signOut();
      const cookieStore = await cookies();
      cookieStore.delete(ACTIVE_ORG_COOKIE);
      return failure("デモ環境の準備が完了していません。時間をおいて再度お試しください。");
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORG_COOKIE, membership.organization_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return success({ redirectTo: "/dashboard" });
  } catch (error) {
    return fromUnknownError(
      error,
      "デモ環境にログインできませんでした。時間をおいて再度お試しください。",
    );
  }
}

export async function signupAction(input: unknown): Promise<ActionResult<{ needsEmailConfirm: boolean }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { display_name: parsed.data.displayName } },
    });

    if (error) {
      return failure("アカウントを作成できませんでした。入力内容を確認してください。");
    }

    return success({ needsEmailConfirm: data.session === null });
  } catch (error) {
    return fromUnknownError(error, "アカウント作成に失敗しました。時間をおいて再度お試しください。");
  }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORG_COOKIE);
  redirect("/login");
}

export async function createOrganizationAction(input: unknown): Promise<ActionResult<{ organizationId: string }>> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return failure("ログインが必要です。");

    const { data, error } = await supabase.rpc("create_organization", {
      p_name: parsed.data.organizationName,
      p_company_name: parsed.data.companyName || parsed.data.organizationName,
    });

    if (error) {
      return failure(describeDatabaseError(error, "組織を作成できませんでした。"));
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORG_COOKIE, data, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return success({ organizationId: data });
  } catch (error) {
    return fromUnknownError(error, "組織の作成に失敗しました。");
  }
}

/**
 * Switching organizations only ever writes a hint cookie. The value is checked
 * against the caller's real memberships here and again on every request in
 * `getOrgContext()`.
 */
export async function switchOrganizationAction(organizationId: string): Promise<ActionResult> {
  try {
    const memberships = await getMemberships();
    if (!memberships.some((membership) => membership.organizationId === organizationId)) {
      return failure("この組織へのアクセス権がありません。");
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return success();
  } catch (error) {
    return fromUnknownError(error, "組織を切り替えられませんでした。");
  }
}
