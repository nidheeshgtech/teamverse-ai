import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseConfig } from "@/lib/env";

/** Request-scoped client acting as the signed-in user (RLS applies). Null when unconfigured. */
export async function createSupabaseServerClient() {
  // Read cookies first so callers are always request-time, even when unconfigured at build time.
  const cookieStore = await cookies();
  const config = getPublicSupabaseConfig();
  if (!config) return null;

  return createServerClient(config.supabaseUrl, config.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes the session.
        }
      },
    },
  });
}
