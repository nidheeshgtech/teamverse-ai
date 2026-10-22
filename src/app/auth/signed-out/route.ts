import { NextResponse } from "next/server";
import { SIGN_IN_PATH } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Clears a session whose account no longer exists (e.g. removed from the workspace) and sends the
 * browser to sign-in. A route handler, because Server Components can't change cookies.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  return NextResponse.redirect(new URL(SIGN_IN_PATH, request.url));
}
