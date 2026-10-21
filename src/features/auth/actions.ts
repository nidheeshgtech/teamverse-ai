"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath, SIGN_IN_PATH } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = { error?: "invalidCredentials" | "genericError" | "unconfigured" } | undefined;

const signInSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(256),
  next: z.string().optional(),
});

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidCredentials" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "unconfigured" };

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
  });
  if (error) return { error: error.status === 400 ? "invalidCredentials" : "genericError" };

  // "/" resolves to the role-specific landing page.
  redirect(safeNextPath(parsed.data.next));
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect(SIGN_IN_PATH);
}

