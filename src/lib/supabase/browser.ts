"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser client acting as the signed-in user (RLS applies). Null when unconfigured. */
export function getSupabaseBrowserClient() {
  if (client) return client;
  const config = getPublicSupabaseConfig();
  if (!config) return null;
  client = createBrowserClient(config.supabaseUrl, config.supabasePublishableKey);
  return client;
}
