"use server";

import { z } from "zod";
import { requireViewer } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { presenceStatuses, type PresenceStatus } from "@/ui/presence";

const availabilitySchema = z.enum(presenceStatuses);

/** Saves the availability the user chose. It is never derived from activity. */
export async function updateAvailability(status: PresenceStatus): Promise<{ ok: boolean }> {
  const parsed = availabilitySchema.safeParse(status);
  if (!parsed.success) return { ok: false };

  const viewer = await requireViewer();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };

  // RLS restricts profile updates to the caller's own row; the eq() keeps intent explicit.
  const { error } = await supabase.from("profiles").update({ availability: parsed.data }).eq("id", viewer.user.id);
  return { ok: !error };
}

/** Opt in/out of sharing read receipts. Off means you are never counted in "Read by" or "Seen". */
export async function updateShareReadReceipts(share: boolean): Promise<{ ok: boolean }> {
  if (typeof share !== "boolean") return { ok: false };

  const viewer = await requireViewer();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };

  const { error } = await supabase.from("profiles").update({ share_read_receipts: share }).eq("id", viewer.user.id);
  return { ok: !error };
}
