import { cache } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { User } from "@supabase/supabase-js";

import type { MemberRole } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_ORG_COOKIE = "aice_active_org";

/**
 * Shown whenever a demo visitor attempts a write. Deliberately free of table
 * names, policy names and SQL: the database refuses the write regardless, and
 * its own error text is never forwarded to the browser.
 */
export const READ_ONLY_MESSAGE =
  "デモ環境では編集・削除はできません。閲覧のみご利用いただけます。";

export interface Membership {
  organizationId: string;
  organizationName: string;
  role: MemberRole;
}

export interface OrgContext {
  user: User;
  organizationId: string;
  organizationName: string;
  role: MemberRole;
  memberships: Membership[];
  /**
   * The shared portfolio demo account. This is a *hint for the UI and for early
   * Server Action guards only* — the authoritative refusal happens in
   * PostgreSQL, so a request that skips this check still cannot write.
   */
  isReadOnly: boolean;
}

/**
 * Always resolves the user through `getUser()` (which validates the JWT against
 * Supabase) rather than `getSession()`, which only decodes a cookie the client
 * could have tampered with.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) return null;
  return user;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name)")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data
    .map((row) => {
      const organization = row.organizations as { id: string; name: string } | null;
      if (!organization) return null;
      return {
        organizationId: row.organization_id,
        organizationName: organization.name,
        role: row.role,
      } satisfies Membership;
    })
    .filter((value): value is Membership => value !== null);
});

/**
 * Asks the database whether the current session is the read-only demo account.
 *
 * The answer comes from `public.is_demo_user()` — the very function the RLS
 * policies and write triggers consult — so the interface can never disagree
 * with what the database will actually allow. Any failure is treated as
 * read-only: a visitor briefly seeing disabled buttons is a far better outcome
 * than showing a normal user's controls to a demo visitor.
 */
export const isReadOnlySession = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_demo_user");
  if (error) {
    console.error("[auth] is_demo_user lookup failed", error.code, error.message);
    return true;
  }
  return data === true;
});

/**
 * Resolves the organization the request operates on.
 *
 * The `aice_active_org` cookie is only ever a *hint*: it is checked against the
 * membership rows returned by the database (which are themselves filtered by
 * RLS), so pointing the cookie at somebody else's organization simply falls
 * back to the user's own first membership.
 */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const memberships = await getMemberships();
  if (memberships.length === 0) return null;

  const isReadOnly = await isReadOnlySession();

  const cookieStore = await cookies();
  const requested = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const active =
    memberships.find((membership) => membership.organizationId === requested) ?? memberships[0];

  return {
    user,
    organizationId: active.organizationId,
    organizationName: active.organizationName,
    role: active.role,
    memberships,
    isReadOnly,
  };
});

/** Guarantees an authenticated user *and* an organization for the page below. */
export async function requireOrgContext(): Promise<OrgContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const context = await getOrgContext();
  if (!context) redirect("/onboarding");

  return context;
}
