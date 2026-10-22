import { describe, expect, it } from "vitest";
import { callPayloadSchema, endReasonOf, isHuddle, isLive, isRingingFor, myStatus, peersOf, type CallPayload } from "@/features/calls/model";

const A = "a0000000-0000-4000-8000-000000000001";
const B = "a0000000-0000-4000-8000-000000000002";

function call(patch: Partial<CallPayload> = {}): CallPayload {
  return callPayloadSchema.parse({
    id: "b0000000-0000-4000-8000-000000000001",
    org_id: "d0000000-0000-4000-8000-000000000001",
    kind: "audio",
    status: "ringing",
    initiated_by: A,
    conversation_id: null,
    livekit_room: "call_b0000000-0000-4000-8000-000000000001",
    answered_at: null,
    ended_at: null,
    end_reason: null,
    created_at: "2026-10-22T10:00:00Z",
    participants: [
      { user_id: A, status: "joined" },
      { user_id: B, status: "ringing" },
    ],
    ...patch,
  });
}

describe("call model", () => {
  it("rings only the callee", () => {
    expect(isRingingFor(call(), B)).toBe(true);
    expect(isRingingFor(call(), A)).toBe(false);
    expect(isRingingFor(call({ status: "active" }), B)).toBe(false);
  });

  it("knows live calls, huddles, peers and my status", () => {
    expect(isLive(call())).toBe(true);
    expect(isLive(call({ status: "ended" }))).toBe(false);
    expect(isHuddle(call({ conversation_id: "c0000000-0000-4000-8000-000000000001" }))).toBe(true);
    expect(peersOf(call(), A)).toEqual([B]);
    expect(myStatus(call(), B)).toBe("ringing");
    expect(myStatus(call(), "a0000000-0000-4000-8000-000000000009")).toBeNull();
  });

  it("explains why a call ended from each side", () => {
    expect(endReasonOf(call({ status: "missed", end_reason: "busy" }), A)).toBe("busy");
    expect(endReasonOf(call({ status: "missed", end_reason: "dnd" }), A)).toBe("dnd");
    expect(endReasonOf(call({ status: "declined" }), A)).toBe("declined");
    expect(endReasonOf(call({ status: "missed" }), A)).toBe("no_answer");
    expect(endReasonOf(call({ status: "missed" }), B)).toBe("missed");
    expect(endReasonOf(call({ status: "ended", end_reason: "room_closed" }), A)).toBe("disconnected");
    expect(endReasonOf(call({ status: "ended", end_reason: "hangup" }), A)).toBe("hangup");
  });

  it("rejects malformed broadcasts", () => {
    expect(callPayloadSchema.safeParse({ id: "x" }).success).toBe(false);
    expect(callPayloadSchema.safeParse({ ...call(), status: "exploded" }).success).toBe(false);
  });
});
