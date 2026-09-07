import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers. It carries the caller's session cookie, so PostgreSQL sees
 * the real `auth.uid()` and applies the RLS policies from migration 0002.
 */
export async function createClient() {
  // `cookies()` is awaited first on purpose: it is what marks the surrounding
  // route as dynamic. Reading configuration first would let Next try to
  // statically prerender an authenticated page and fail the build.
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `cookies()` is read-only inside Server Components. Session refresh
          // is handled by the proxy, so this is safe to ignore.
        }
      },
    },
  });
}
