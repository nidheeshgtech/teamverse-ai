import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/lib/env";

/**
 * Privileged client that BYPASSES row level security. Only for narrowly scoped server work
 * (e.g. creating an auth user while accepting a verified invitation). Never import from client code.
 */
export function createSupabaseAdminClient() {
  const config = getPublicSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!config || !secretKey) return null;

  return createClient(config.supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
