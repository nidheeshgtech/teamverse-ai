import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ChatPerson } from "./model";

type ProfileRow = { display_name: string; title: string | null; avatar_url: string | null; timezone: string; availability: string } | null;

/** Everyone in the organization (names, avatars, departments), read through RLS. Chat content is loaded client-side. */
export async function getChatPeople(orgId: string): Promise<ChatPerson[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("memberships")
    .select("user_id, departments(slug), profiles(display_name, title, avatar_url, timezone, availability)")
    .eq("org_id", orgId);
  if (error) throw new Error(`Failed to load people: ${error.message}`);

  return (data ?? []).flatMap((m) => {
    const profile = m.profiles as unknown as ProfileRow;
    const department = m.departments as unknown as { slug: string } | null;
    if (!profile) return [];
    return [
      {
        userId: m.user_id as string,
        displayName: profile.display_name,
        title: profile.title,
        avatarUrl: profile.avatar_url,
        timezone: profile.timezone,
        departmentSlug: department?.slug ?? null,
        availability: profile.availability,
      },
    ];
  });
}
