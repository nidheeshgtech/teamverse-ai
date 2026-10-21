import { z } from "zod";

// NEXT_PUBLIC_* values must be read with literal property access so Next can inline them.
const publicSchema = z.object({
  supabaseUrl: z.url(),
  supabasePublishableKey: z.string().min(1),
});

export type PublicSupabaseConfig = z.infer<typeof publicSchema>;

/** Returns null when Supabase is not configured, so callers can render an honest "unconfigured" state. */
export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const parsed = publicSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return parsed.success ? parsed.data : null;
}

export function isSupabaseConfigured(): boolean {
  return getPublicSupabaseConfig() !== null;
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Dev-only preview routes (/dev/*): always on in development, opt-in elsewhere (e.g. CI e2e). */
export function isDevPreviewEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_PREVIEW === "1";
}
