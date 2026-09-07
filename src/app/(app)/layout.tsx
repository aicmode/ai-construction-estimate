import { AppShell } from "@/components/layout/app-shell";
import { requireOrgContext } from "@/server/auth";
import { isDemoUserEmail } from "@/server/demo";

/**
 * Every screen below this layout is per-user data behind a session cookie, so
 * none of it may be prerendered or cached at build time. Declaring it here also
 * keeps `next build` from touching Supabase.
 */
export const dynamic = "force-dynamic";

/**
 * Server-side authentication gate for every management screen.
 *
 * The proxy performs an early redirect for unauthenticated requests, but
 * this layout re-verifies the session against Supabase and resolves the active
 * organization, so access control never depends on client-side state alone.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { organizationName, memberships, user, isReadOnly } = await requireOrgContext();

  return (
    <AppShell
      organizationName={organizationName}
      memberships={memberships}
      userLabel={isDemoUserEmail(user.email) ? "デモユーザー" : (user.email ?? "ログイン中")}
      readOnly={isReadOnly}
    >
      {children}
    </AppShell>
  );
}
