import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/calls/:callId/leave — hang up via navigator.sendBeacon when the tab closes mid-call.
 * Same rules as the leave_call RPC (RLS + participant check).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/calls/[callId]/leave">) {
  const { callId } = await ctx.params;
  if (!z.uuid().safeParse(callId).success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const reason = await request.text().then((t) => (t ? (JSON.parse(t) as { reason?: string }).reason : undefined)).catch(() => undefined);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  const { error } = await supabase.rpc("leave_call", { p_call_id: callId, p_reason: reason ?? "hangup" });
  return NextResponse.json({ ok: !error }, { status: error ? 403 : 200 });
}
