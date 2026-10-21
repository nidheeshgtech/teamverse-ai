import "server-only";
import { z } from "zod";
import { roles } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const memberSchema = z.object({
  id: z.uuid(),
  role: z.enum(roles),
  profile: z.object({ display_name: z.string(), email: z.string().nullable(), avatar_url: z.string().nullable() }),
  department: z.object({ slug: z.string() }).nullable(),
});

const departmentSchema = z.object({ id: z.uuid(), slug: z.string() });

const invitationSchema = z.object({ id: z.uuid(), email: z.string(), role: z.enum(roles), expires_at: z.string() });

export type OrgMember = z.infer<typeof memberSchema>;
export type OrgDepartment = z.infer<typeof departmentSchema>;
export type PendingInvitation = z.infer<typeof invitationSchema>;

/** Admin overview for one organization. All reads go through RLS as the signed-in admin. */
export async function getOrgAdminData(orgId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const [members, departments, invitations] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, role, profile:profiles(display_name, email, avatar_url), department:departments(slug)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true }),
    supabase.from("departments").select("id, slug").eq("org_id", orgId).order("sort_order"),
    supabase
      .from("org_invitations")
      .select("id, email, role, expires_at")
      .eq("org_id", orgId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  for (const result of [members, departments, invitations]) {
    if (result.error) throw new Error(`Failed to load organization data: ${result.error.message}`);
  }

  return {
    members: z.array(memberSchema).parse(members.data),
    departments: z.array(departmentSchema).parse(departments.data),
    invitations: z.array(invitationSchema).parse(invitations.data),
  };
}
