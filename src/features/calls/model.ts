import { z } from "zod";

/** Shape returned by the call RPCs and broadcast as inbox event 'call' (see public.call_payload). */
export const callPayloadSchema = z.object({
  id: z.uuid(),
  org_id: z.uuid(),
  kind: z.enum(["audio", "video"]),
  status: z.enum(["ringing", "active", "ended", "missed", "declined", "failed"]),
  initiated_by: z.uuid().nullable(),
  conversation_id: z.uuid().nullable(),
  livekit_room: z.string().nullable(),
  answered_at: z.string().nullable(),
  ended_at: z.string().nullable(),
  end_reason: z.string().nullable(),
  created_at: z.string(),
  participants: z.array(z.object({ user_id: z.uuid(), status: z.enum(["invited", "ringing", "joined", "left", "declined", "missed"]) })),
});
export type CallPayload = z.infer<typeof callPayloadSchema>;
export type CallKind = CallPayload["kind"];

/** Caller gives up after this; the server treats ringing older than 45s as missed anyway. */
export const RING_TIMEOUT_MS = 30_000;

export const isLive = (call: CallPayload) => call.status === "ringing" || call.status === "active";
export const isHuddle = (call: CallPayload) => call.conversation_id !== null;

/** A call that is ringing *me* right now (1:1, someone else started it). */
export function isRingingFor(call: CallPayload, userId: string): boolean {
  return (
    call.status === "ringing" &&
    call.initiated_by !== userId &&
    call.participants.some((p) => p.user_id === userId && p.status === "ringing")
  );
}

export function myStatus(call: CallPayload, userId: string) {
  return call.participants.find((p) => p.user_id === userId)?.status ?? null;
}

/** The other people in the call (for 1:1: the person on the other end). */
export const peersOf = (call: CallPayload, userId: string) => call.participants.filter((p) => p.user_id !== userId).map((p) => p.user_id);

/** Why a call ended, as a message key under calls.ended.* */
export type EndReason = "busy" | "dnd" | "declined" | "no_answer" | "missed" | "hangup" | "disconnected" | "unconfigured" | "failed";

export function endReasonOf(call: CallPayload, userId: string): EndReason {
  if (call.end_reason === "busy" || call.end_reason === "dnd" || call.end_reason === "no_answer") return call.end_reason;
  if (call.status === "declined") return "declined";
  if (call.status === "missed") return call.initiated_by === userId ? "no_answer" : "missed";
  if (call.end_reason === "disconnected" || call.end_reason === "room_closed") return "disconnected";
  return "hangup";
}
