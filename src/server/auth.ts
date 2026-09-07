import { cache } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { User } from "@supabase/supabase-js";

import type { MemberRole } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_ORG_COOKIE = "aice_active_org";

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
