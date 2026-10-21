"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, requireViewer } from "@/lib/auth/dal";
import { ADMIN_ROLES, roles } from "@/lib/auth/roles";
import { getSiteUrl } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInvitationPreview } from "./queries";
import { generateInviteToken, hashInviteToken, INVITE_TTL_DAYS } from "./token";

// ---------- Admin: create / revoke ----------

export type CreateInvitationState =
  | { status: "idle" }
  | { status: "error"; error: "inviteInvalidEmail" | "inviteError" }
  | { status: "created"; email: string; link: string };

const createSchema = z.object({
  email: z.email().max(320),
  role: z.enum(roles),
  departmentId: z.union([z.uuid(), z.literal("")]).optional(),
});

export async function createInvitation(_prev: CreateInvitationState, formData: FormData): Promise<CreateInvitationState> {
  const viewer = await requireRole(ADMIN_ROLES);
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "inviteInvalidEmail" };

  // Only owners may invite owners (also enforced by RLS).
  if (parsed.data.role === "owner" && viewer.membership.role !== "owner") return { status: "error", error: "inviteError" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", error: "inviteError" };

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("org_invitations").insert({
    org_id: viewer.membership.orgId,
    email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    department_id: parsed.data.departmentId || null,
    token_hash: hashInviteToken(token),
    invited_by: viewer.user.id,
    expires_at: expiresAt,
  });
  if (error) return { status: "error", error: "inviteError" };

  revalidatePath("/admin");
  // The raw token exists only in this response; the database keeps the hash.
  return { status: "created", email: parsed.data.email, link: `${getSiteUrl()}/invite/${token}` };
}

export async function revokeInvitation(formData: FormData) {
  const viewer = await requireRole(ADMIN_ROLES);
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createSupabaseServerClient();
  await supabase
    ?.from("org_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("org_id", viewer.membership.orgId);
  revalidatePath("/admin");
}

// ---------- Invitee: accept ----------

export type AcceptState =
  | undefined
  | { error: "invalid" | "expired" | "revoked" | "accepted" | "existingAccount" | "serviceUnavailable" | "nameRequired" | "passwordTooShort" | "wrongAccount" | "genericError" };

const newAccountSchema = z.object({
  token: z.string(),
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(12).max(256),
});

/** New user: create the auth account for the invited email, sign in, then accept via RPC. */
export async function acceptInvitationWithNewAccount(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const raw = Object.fromEntries(formData);
  const parsed = newAccountSchema.safeParse(raw);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "password" ? "passwordTooShort" : field === "displayName" ? "nameRequired" : "invalid" };
  }

  const preview = await getInvitationPreview(parsed.data.token);
  if (!preview) return { error: "invalid" };
  if (preview.status !== "valid") return { error: preview.status };

  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "serviceUnavailable" };

  const { error: createError } = await admin.auth.admin.createUser({
    email: preview.email,
    password: parsed.data.password,
    email_confirm: true, // Possession of the emailed invite link is the verification.
    user_metadata: { display_name: parsed.data.displayName },
  });
  if (createError) {
    return { error: createError.code === "email_exists" || createError.status === 422 ? "existingAccount" : "genericError" };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "serviceUnavailable" };
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: preview.email, password: parsed.data.password });
  if (signInError) return { error: "genericError" };

  const { error: acceptError } = await supabase.rpc("accept_invitation", { raw_token: parsed.data.token });
  if (acceptError) return { error: "genericError" };

  redirect("/");
}

/** Existing, signed-in user whose email matches the invitation. */
export async function acceptInvitationSignedIn(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const viewer = await requireViewer();
  const token = z.string().safeParse(formData.get("token"));
  if (!token.success) return { error: "invalid" };

  const preview = await getInvitationPreview(token.data);
  if (!preview) return { error: "invalid" };
  if (preview.status !== "valid") return { error: preview.status };
  if (preview.email.toLowerCase() !== viewer.user.email.toLowerCase()) return { error: "wrongAccount" };

  const supabase = await createSupabaseServerClient();
  const { error } = (await supabase?.rpc("accept_invitation", { raw_token: token.data })) ?? { error: true };
  if (error) return { error: "genericError" };

  redirect("/");
}
