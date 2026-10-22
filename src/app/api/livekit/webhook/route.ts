import { WebhookReceiver } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getLiveKitConfig } from "@/lib/livekit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/livekit/webhook — LiveKit tells us when someone left or a room closed, so calls end
 * even if a browser vanished without hanging up. The signature (JWT in Authorization) is verified
 * with the API secret before anything happens. Uses the service role only for these two RPCs.
 */
export async function POST(request: Request) {
  const config = getLiveKitConfig();
  const admin = createSupabaseAdminClient();
  if (!config || !admin) return NextResponse.json({ error: "unconfigured" }, { status: 503 });

  let event;
  try {
    event = await new WebhookReceiver(config.apiKey, config.apiSecret).receive(await request.text(), request.headers.get("authorization") ?? undefined);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const room = event.room?.name;
  if (room?.startsWith("call_")) {
    if (event.event === "participant_left" && event.participant?.identity) {
      await admin.rpc("livekit_participant_left", { p_room: room, p_user: event.participant.identity });
    } else if (event.event === "room_finished") {
      await admin.rpc("livekit_room_finished", { p_room: room });
    }
  }
  return NextResponse.json({ ok: true });
}
