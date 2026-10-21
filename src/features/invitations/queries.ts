import "server-only";
import { z } from "zod";
import { roles } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { looksLikeInviteToken } from "./token";

const previewSchema = z.object({
  org_name: z.string(),
  email: z.string(),
  role: z.enum(roles),
  expires_at: z.string(),
  status: z.enum(["valid", "expired", "revoked", "accepted"]),
});

export type InvitationPreview = z.infer<typeof previewSchema>;

/** Public, read-only preview of an invitation (security-definer RPC; reveals nothing for unknown tokens). */
export async function getInvitationPreview(token: string): Promise<InvitationPreview | null> {
  if (!looksLikeInviteToken(token)) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("invitation_preview", { raw_token: token });
  if (error) throw new Error(`invitation_preview failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? previewSchema.parse(row) : null;
}
