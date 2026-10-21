import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { presenceStatuses } from "@/ui/presence";
import { SIGN_IN_PATH } from "./paths";
import { roles, type Role } from "./roles";

const viewerSchema = z.object({
  user: z.object({ id: z.uuid(), email: z.string() }),
  profile: z.object({
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    title: z.string().nullable(),
    timezone: z.string(),
    locale: z.string(),
    availability: z.enum(presenceStatuses),
  }),
  membership: z
    .object({
      orgId: z.uuid(),
      orgName: z.string(),
      orgIsDemo: z.boolean(),
      role: z.enum(roles),
      departmentSlug: z.string().nullable(),
    })
    .nullable(),
});

export type Viewer = z.infer<typeof viewerSchema>;

/**
 * The signed-in user with profile and (first) organization membership, or null.
 * Reads go through the user's own RLS-scoped client; nothing here bypasses policies.
 * Cached per request so layouts and pages can both call it.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url, title, timezone, locale, availability")
      .eq("id", claims.sub)
      .single(),
    supabase
      .from("memberships")
      .select("org_id, role, organizations(name, is_demo), departments(slug)")
      .eq("user_id", claims.sub)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) throw new Error(`Failed to load profile: ${profileResult.error.message}`);
  if (membershipResult.error) throw new Error(`Failed to load membership: ${membershipResult.error.message}`);

  const profile = profileResult.data;
  const membership = membershipResult.data as
    | { org_id: string; role: string; organizations: { name: string; is_demo: boolean } | null; departments: { slug: string } | null }
    | null;

  return viewerSchema.parse({
    user: { id: claims.sub, email: claims.email ?? "" },
    profile: {
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      title: profile.title,
      timezone: profile.timezone,
      locale: profile.locale,
      availability: profile.availability,
    },
    membership:
      membership && membership.organizations
        ? {
            orgId: membership.org_id,
            orgName: membership.organizations.name,
            orgIsDemo: membership.organizations.is_demo,
            role: membership.role,
            departmentSlug: membership.departments?.slug ?? null,
          }
        : null,
  });
});

/** Redirects to sign-in when signed out. Use at the top of any protected Server Component or action. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(SIGN_IN_PATH);
  return viewer;
}

/** Signed in AND a member of an organization; otherwise shows the no-organization page. */
export async function requireMember(): Promise<Viewer & { membership: NonNullable<Viewer["membership"]> }> {
  const viewer = await requireViewer();
  if (!viewer.membership) redirect("/no-organization");
  return viewer as Viewer & { membership: NonNullable<Viewer["membership"]> };
}

export async function requireRole(allowed: readonly Role[]) {
  const viewer = await requireMember();
  if (!allowed.includes(viewer.membership.role)) redirect("/forbidden");
  return viewer;
}
