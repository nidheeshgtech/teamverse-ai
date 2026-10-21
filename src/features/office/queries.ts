import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { officeDataSchema, type OfficeData } from "./model";

type Row<T> = T | null;

/** Active layout, seats, departments and people for one organization, read through RLS. */
export async function getOfficeData(orgId: string): Promise<OfficeData | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const [org, layout, departments, members] = await Promise.all([
    supabase.from("organizations").select("name, is_demo").eq("id", orgId).single(),
    supabase.from("office_layouts").select("id, name, scene").eq("org_id", orgId).eq("is_active", true).maybeSingle(),
    supabase.from("departments").select("id, slug, sort_order").eq("org_id", orgId).order("sort_order"),
    supabase
      .from("memberships")
      .select("user_id, role, department_id, profiles(display_name, title, avatar_url, timezone, availability, avatar_character)")
      .eq("org_id", orgId),
  ]);
  for (const result of [org, layout, departments, members]) {
    if (result.error) throw new Error(`Failed to load office: ${result.error.message}`);
  }
  if (!layout.data || !org.data) return null;

  const seats = await supabase
    .from("office_seats")
    .select("id, label, department_id, position, assigned_user_id")
    .eq("layout_id", layout.data.id)
    .order("label");
  if (seats.error) throw new Error(`Failed to load seats: ${seats.error.message}`);

  const slugById = new Map((departments.data ?? []).map((d) => [d.id as string, d.slug as string]));

  return officeDataSchema.parse({
    orgName: org.data.name,
    orgIsDemo: org.data.is_demo,
    layoutName: layout.data.name,
    scene: layout.data.scene,
    departments: (departments.data ?? []).map((d) => ({ slug: d.slug, sortOrder: d.sort_order })),
    seats: (seats.data ?? []).map((s) => ({
      id: s.id,
      label: s.label,
      departmentSlug: s.department_id ? (slugById.get(s.department_id) ?? null) : null,
      position: s.position,
      assignedUserId: s.assigned_user_id,
    })),
    people: (members.data ?? []).flatMap((m) => {
      const profile = m.profiles as unknown as Row<{ display_name: string; title: string | null; avatar_url: string | null; timezone: string; availability: string; avatar_character: string | null }>;
      if (!profile) return [];
      return [
        {
          userId: m.user_id,
          displayName: profile.display_name,
          title: profile.title,
          avatarUrl: profile.avatar_url,
          timezone: profile.timezone,
          role: m.role,
          departmentSlug: m.department_id ? (slugById.get(m.department_id) ?? null) : null,
          availability: profile.availability,
          character: profile.avatar_character,
        },
      ];
    }),
  });
}
