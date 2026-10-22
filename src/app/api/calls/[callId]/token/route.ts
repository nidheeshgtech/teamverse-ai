import { NextResponse } from "next/server";
import { z } from "zod";
import { getLiveKitConfig, mintCallToken } from "@/lib/livekit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/calls/:callId/token — a LiveKit join token for the signed-in participant.
 * Authorization comes from RLS: the call and the caller's participant row must be visible to the
 * user, the participant must have joined (answered / started), and the call must still be live.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/calls/[callId]/token">) {
  const { callId } = await ctx.params;
  if (!z.uuid().safeParse(callId).success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const config = getLiveKitConfig();
  if (!config) return NextResponse.json({ error: "unconfigured" }, { status: 503 });

  const supabase = await createSupabaseServerClient();
  const { data: claims } = (await supabase?.auth.getClaims()) ?? { data: null };
  const userId = claims?.claims?.sub;
  if (!supabase || !userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [call, me, profile] = await Promise.all([
    supabase.from("calls").select("status, livekit_room").eq("id", callId).maybeSingle(),
    supabase.from("call_participants").select("status").eq("call_id", callId).eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", userId).single(),
  ]);
  if (!call.data || !me.data || !call.data.livekit_room) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (me.data.status !== "joined" || !["ringing", "active"].includes(call.data.status)) {
    return NextResponse.json({ error: "not_joined" }, { status: 409 });
  }

  const token = await mintCallToken(config, call.data.livekit_room, userId, profile.data?.display_name ?? "");
  return NextResponse.json({ token, url: config.url }, { headers: { "Cache-Control": "no-store" } });
}
