"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ConnectionQuality, ConnectionState, Room, RoomEvent, Track, type Participant, type RemoteTrack } from "livekit-client";
import { useEffect, useSyncExternalStore } from "react";
import { z } from "zod";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getInboxStore, getLiveTransport, type InboxStore } from "@/features/messaging/inbox-store";
import { callPayloadSchema, endReasonOf, isHuddle, isLive, isRingingFor, RING_TIMEOUT_MS, type CallKind, type CallPayload, type EndReason } from "./model";
import { playTone } from "./tones";

export type CallPhase = "idle" | "outgoing" | "incoming" | "connecting" | "active" | "reconnecting" | "ended";
/** Problems shown in the call UI without ending the call. */
export type CallIssue = "mic_denied" | "no_mic" | "camera_denied" | "no_camera" | "screen_denied" | "audio_blocked" | "action_failed";
export type Quality = "excellent" | "good" | "poor" | "lost" | "unknown";

export type ParticipantView = {
  identity: string;
  isLocal: boolean;
  micOn: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  speaking: boolean;
  level: number;
  quality: Quality;
  cameraTrack: Track | null;
  screenTrack: Track | null;
};

export type CallSnapshot = {
  /** Calls work on this server (LiveKit configured). */
  available: boolean;
  phase: CallPhase;
  call: CallPayload | null;
  kind: CallKind;
  /** People shown before the call connects (1:1 peer). */
  peerIds: string[];
  endReason: EndReason | null;
  issues: CallIssue[];
  micOn: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  minimized: boolean;
  connectedAt: number | null;
  participants: ParticipantView[];
  /** Live huddles in my conversations, by conversation id (for "Join huddle" banners). */
  huddles: ReadonlyMap<string, CallPayload>;
};

const IDLE: Omit<CallSnapshot, "available" | "huddles"> = {
  phase: "idle",
  call: null,
  kind: "audio",
  peerIds: [],
  endReason: null,
  issues: [],
  micOn: false,
  cameraOn: false,
  screenOn: false,
  minimized: false,
  connectedAt: null,
  participants: [],
};

const tokenSchema = z.object({ token: z.string(), url: z.string() });
const qualityOf = (q: ConnectionQuality): Quality =>
  q === ConnectionQuality.Excellent ? "excellent" : q === ConnectionQuality.Good ? "good" : q === ConnectionQuality.Poor ? "poor" : q === ConnectionQuality.Lost ? "lost" : "unknown";

/**
 * One call at a time for the signed-in user. Call state lives in Postgres (RPCs + broadcasts);
 * media goes through a LiveKit room joined with a token minted server-side for participants only.
 */
export class CallStore {
  private snapshot: CallSnapshot;
  private listeners = new Set<() => void>();
  private room: Room | null = null;
  private stopTone: (() => void) | null = null;
  private ringTimer: ReturnType<typeof setTimeout> | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private levelTimer: ReturnType<typeof setInterval> | null = null;
  private audioElements = new Map<string, HTMLMediaElement>();
  private consumers = 0;
  private teardownInbox: (() => void) | null = null;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly inbox: InboxStore,
    readonly userId: string,
    readonly orgId: string,
    available: boolean,
  ) {
    this.snapshot = { ...IDLE, available, huddles: new Map() };
  }

  // ---- store plumbing ------------------------------------------------------------------------
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private set(patch: Partial<CallSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  retain() {
    if (this.consumers++ === 0) this.open();
    return () => {
      if (--this.consumers === 0) this.close();
    };
  }

  private open() {
    const releaseInbox = this.inbox.retain();
    const unsubscribe = this.inbox.subscribeCalls((payload) => {
      const parsed = callPayloadSchema.safeParse(payload);
      if (parsed.success) this.onCallEvent(parsed.data);
    });
    const onUnload = () => {
      const call = this.snapshot.call;
      if (call && this.snapshot.phase !== "idle" && this.snapshot.phase !== "ended" && this.snapshot.phase !== "incoming") {
        navigator.sendBeacon(`/api/calls/${call.id}/leave`, new Blob([JSON.stringify({ reason: "hangup" })], { type: "application/json" }));
      }
    };
    window.addEventListener("pagehide", onUnload);
    this.teardownInbox = () => {
      unsubscribe();
      releaseInbox();
      window.removeEventListener("pagehide", onUnload);
    };
    void this.loadLiveCalls();
  }

  private close() {
    this.teardownInbox?.();
    this.teardownInbox = null;
  }

  /** Catch up after (re)loading: a call ringing me right now, and live huddles. */
  private async loadLiveCalls() {
    const { data } = await this.supabase.rpc("my_live_calls");
    const calls = z.array(callPayloadSchema).safeParse(data ?? []);
    if (!calls.success) return;
    for (const call of calls.data) this.onCallEvent(call);
  }

  // ---- server events -------------------------------------------------------------------------
  private onCallEvent(call: CallPayload) {
    if (isHuddle(call)) {
      const huddles = new Map(this.snapshot.huddles);
      if (isLive(call)) huddles.set(call.conversation_id!, call);
      else huddles.delete(call.conversation_id!);
      this.set({ huddles });
    }

    const current = this.snapshot.call;
    if (current && current.id === call.id) {
      this.set({ call });
      if (!isLive(call)) return this.finish(endReasonOf(call, this.userId));
      if (call.status === "active" && this.snapshot.phase === "outgoing") {
        this.clearRinging();
        this.set({ phase: this.room?.state === ConnectionState.Connected ? "active" : "connecting", connectedAt: Date.now() });
      }
      return;
    }

    if (this.snapshot.phase === "idle" && isRingingFor(call, this.userId)) {
      this.set({ ...IDLE, phase: "incoming", call, kind: call.kind, peerIds: call.initiated_by ? [call.initiated_by] : [] });
      this.stopTone = playTone("ring");
      this.ringTimer = setTimeout(() => this.snapshot.call?.id === call.id && this.snapshot.phase === "incoming" && this.finish("missed"), RING_TIMEOUT_MS);
    }
  }

  // ---- actions -------------------------------------------------------------------------------
  private busy() {
    return this.snapshot.phase !== "idle" && this.snapshot.phase !== "ended";
  }

  async startCall(peerId: string, kind: CallKind) {
    if (this.busy() || !this.snapshot.available) return;
    this.resetNow();
    this.set({ phase: "outgoing", kind, peerIds: [peerId] });
    const { data, error } = await this.supabase.rpc("start_call", { p_org_id: this.orgId, p_callee: peerId, p_kind: kind });
    const call = callPayloadSchema.safeParse(data);
    if (error || !call.success) return this.finish("failed");
    this.set({ call: call.data });
    if (!isLive(call.data)) return this.finish(endReasonOf(call.data, this.userId));
    if (call.data.status === "active") {
      // The callee answered a call that already existed between us.
      return this.connect(call.data, kind === "video");
    }
    this.stopTone = playTone("ringback");
    this.ringTimer = setTimeout(() => {
      if (this.snapshot.phase === "outgoing") void this.hangup("no_answer");
    }, RING_TIMEOUT_MS);
    // Join the room while ringing so media is ready the moment they answer.
    await this.connect(call.data, kind === "video", { keepPhase: true });
  }

  /** Start (or join) the huddle of a group conversation. */
  async startHuddle(conversationId: string, kind: CallKind = "audio") {
    if (this.busy() || !this.snapshot.available) return;
    this.resetNow();
    this.set({ phase: "connecting", kind });
    const { data, error } = await this.supabase.rpc("start_huddle", { p_conversation_id: conversationId, p_kind: kind });
    const call = callPayloadSchema.safeParse(data);
    if (error || !call.success) return this.finish("failed");
    this.set({ call: call.data, connectedAt: Date.now() });
    await this.connect(call.data, kind === "video");
  }

  async accept(withVideo: boolean) {
    const call = this.snapshot.call;
    if (!call || this.snapshot.phase !== "incoming") return;
    this.clearRinging();
    this.set({ phase: "connecting" });
    const { data, error } = await this.supabase.rpc("answer_call", { p_call_id: call.id });
    const answered = callPayloadSchema.safeParse(data);
    if (error || !answered.success) return this.finish(error?.code === "22023" ? "missed" : "failed");
    this.set({ call: answered.data, connectedAt: Date.now() });
    await this.connect(answered.data, withVideo);
  }

  async decline() {
    const call = this.snapshot.call;
    if (!call || this.snapshot.phase !== "incoming") return;
    this.clearRinging();
    await this.supabase.rpc("decline_call", { p_call_id: call.id });
    this.resetNow();
  }

  async hangup(reason: "hangup" | "no_answer" | "cancelled" = "hangup") {
    const call = this.snapshot.call;
    const wasRinging = this.snapshot.phase === "outgoing";
    this.finish(reason === "no_answer" ? "no_answer" : "hangup");
    if (call) await this.supabase.rpc("leave_call", { p_call_id: call.id, p_reason: wasRinging && reason === "hangup" ? "cancelled" : reason });
  }

  async toggleMic() {
    if (!this.room) return;
    const next = !this.room.localParticipant.isMicrophoneEnabled;
    try {
      await this.room.localParticipant.setMicrophoneEnabled(next);
      this.dropIssue("mic_denied", "no_mic");
    } catch (error) {
      this.addIssue(mediaIssue(error, "mic"));
    }
    this.sync();
  }

  async toggleCamera() {
    if (!this.room) return;
    const next = !this.room.localParticipant.isCameraEnabled;
    try {
      await this.room.localParticipant.setCameraEnabled(next);
      this.dropIssue("camera_denied", "no_camera");
    } catch (error) {
      this.addIssue(mediaIssue(error, "camera"));
    }
    this.sync();
  }

  /** Phones: front/back camera. Desktops: next camera. */
  async switchCamera() {
    if (!this.room) return;
    const devices = await Room.getLocalDevices("videoinput");
    if (devices.length < 2) return;
    const current = this.room.getActiveDevice("videoinput");
    const index = devices.findIndex((d) => d.deviceId === current);
    await this.room.switchActiveDevice("videoinput", devices[(index + 1) % devices.length].deviceId).catch(() => this.addIssue("action_failed"));
  }

  /** Only during a connected call, and only from this explicit click. */
  async toggleScreenShare() {
    if (!this.room || (this.snapshot.phase !== "active" && this.snapshot.phase !== "reconnecting")) return;
    const next = !this.room.localParticipant.isScreenShareEnabled;
    try {
      await this.room.localParticipant.setScreenShareEnabled(next, { audio: false });
      this.dropIssue("screen_denied");
    } catch {
      this.addIssue("screen_denied");
    }
    this.sync();
  }

  async enableAudio() {
    await this.room?.startAudio().catch(() => {});
    this.dropIssue("audio_blocked");
  }

  setMinimized(minimized: boolean) {
    this.set({ minimized });
  }

  dismiss() {
    if (this.snapshot.phase === "ended") this.resetNow();
  }

  // ---- LiveKit -------------------------------------------------------------------------------
  private async connect(call: CallPayload, video: boolean, options: { keepPhase?: boolean } = {}) {
    let credentials: z.infer<typeof tokenSchema>;
    try {
      const response = await fetch(`/api/calls/${call.id}/token`, { method: "POST" });
      if (response.status === 503) {
        await this.supabase.rpc("leave_call", { p_call_id: call.id, p_reason: "cancelled" });
        return this.finish("unconfigured");
      }
      credentials = tokenSchema.parse(await response.json());
    } catch {
      await this.supabase.rpc("leave_call", { p_call_id: call.id, p_reason: "cancelled" });
      return this.finish("failed");
    }
    if (this.snapshot.call?.id !== call.id) return; // hung up meanwhile

    const room = new Room({ adaptiveStream: true, dynacast: true });
    this.room = room;
    room
      .on(RoomEvent.ParticipantConnected, () => this.sync())
      .on(RoomEvent.ParticipantDisconnected, () => this.sync())
      .on(RoomEvent.TrackSubscribed, (track) => {
        this.attachAudio(track);
        this.sync();
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        this.detachAudio(track);
        this.sync();
      })
      .on(RoomEvent.TrackMuted, () => this.sync())
      .on(RoomEvent.TrackUnmuted, () => this.sync())
      .on(RoomEvent.LocalTrackPublished, () => this.sync())
      .on(RoomEvent.LocalTrackUnpublished, () => this.sync())
      .on(RoomEvent.ActiveSpeakersChanged, () => this.sync())
      .on(RoomEvent.ConnectionQualityChanged, () => this.sync())
      .on(RoomEvent.AudioPlaybackStatusChanged, () => (room.canPlaybackAudio ? this.dropIssue("audio_blocked") : this.addIssue("audio_blocked")))
      .on(RoomEvent.Reconnecting, () => this.set({ phase: "reconnecting" }))
      .on(RoomEvent.Reconnected, () => this.set({ phase: "active" }))
      .on(RoomEvent.Disconnected, () => {
        if (this.room === room && this.snapshot.phase !== "ended" && this.snapshot.phase !== "idle") this.finish("disconnected");
      });

    try {
      await room.connect(credentials.url, credentials.token);
    } catch {
      await this.supabase.rpc("leave_call", { p_call_id: call.id, p_reason: "cancelled" });
      return this.finish("failed");
    }
    if (this.room !== room) return void room.disconnect();

    // keepPhase: the caller joins while still ringing, unless the callee already answered.
    if (!options.keepPhase || this.snapshot.call?.status === "active") this.set({ phase: "active", connectedAt: this.snapshot.connectedAt ?? Date.now() });
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (error) {
      this.addIssue(mediaIssue(error, "mic"));
    }
    if (video) {
      try {
        await room.localParticipant.setCameraEnabled(true);
      } catch (error) {
        this.addIssue(mediaIssue(error, "camera"));
      }
    }
    if (!room.canPlaybackAudio) this.addIssue("audio_blocked");
    this.levelTimer = setInterval(() => this.sync(), 250);
    this.sync();
  }

  private attachAudio(track: RemoteTrack) {
    if (track.kind !== Track.Kind.Audio || !track.sid) return;
    const element = track.attach();
    element.hidden = true;
    document.body.appendChild(element);
    this.audioElements.set(track.sid, element);
  }

  private detachAudio(track: RemoteTrack) {
    if (!track.sid) return;
    const element = this.audioElements.get(track.sid);
    if (!element) return;
    track.detach(element);
    element.remove();
    this.audioElements.delete(track.sid);
  }

  /** Rebuild the participant list from the room (cheap; called on events and ~4x/s for levels). */
  private sync() {
    const room = this.room;
    if (!room) return;
    const view = (p: Participant, isLocal: boolean): ParticipantView => ({
      identity: p.identity,
      isLocal,
      micOn: p.isMicrophoneEnabled,
      cameraOn: p.isCameraEnabled,
      screenOn: p.isScreenShareEnabled,
      speaking: p.isSpeaking,
      level: p.audioLevel,
      quality: qualityOf(p.connectionQuality),
      cameraTrack: p.getTrackPublication(Track.Source.Camera)?.track ?? null,
      screenTrack: p.getTrackPublication(Track.Source.ScreenShare)?.track ?? null,
    });
    const local = room.localParticipant;
    this.set({
      micOn: local.isMicrophoneEnabled,
      cameraOn: local.isCameraEnabled,
      screenOn: local.isScreenShareEnabled,
      participants: [view(local, true), ...[...room.remoteParticipants.values()].map((p) => view(p, false))],
    });
  }

  private addIssue(issue: CallIssue) {
    if (!this.snapshot.issues.includes(issue)) this.set({ issues: [...this.snapshot.issues, issue] });
  }
  private dropIssue(...issues: CallIssue[]) {
    if (this.snapshot.issues.some((i) => issues.includes(i))) this.set({ issues: this.snapshot.issues.filter((i) => !issues.includes(i)) });
  }

  private clearRinging() {
    this.stopTone?.();
    this.stopTone = null;
    if (this.ringTimer) clearTimeout(this.ringTimer);
    this.ringTimer = null;
  }

  /** Show why the call ended for a moment, then return to idle. */
  private finish(reason: EndReason) {
    this.clearRinging();
    if (this.levelTimer) clearInterval(this.levelTimer);
    this.levelTimer = null;
    const room = this.room;
    this.room = null;
    void room?.disconnect();
    for (const element of this.audioElements.values()) element.remove();
    this.audioElements.clear();
    this.set({ phase: "ended", endReason: reason, participants: [], micOn: false, cameraOn: false, screenOn: false, minimized: false });
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.resetNow(), reason === "hangup" ? 2500 : 5000);
  }

  private resetNow() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = null;
    this.set({ ...IDLE });
  }
}

function mediaIssue(error: unknown, device: "mic" | "camera"): CallIssue {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return device === "mic" ? "mic_denied" : "camera_denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return device === "mic" ? "no_mic" : "no_camera";
  return "action_failed";
}

let store: { key: string; value: CallStore } | null = null;
const registry = new Set<() => void>();

/** The call store for the signed-in user (one per tab). Null when Supabase isn't configured. */
export function getCallStore(orgId: string, userId: string, available: boolean): CallStore | null {
  const key = `${orgId}:${userId}`;
  if (store?.key === key) return store.value;
  const supabase = getSupabaseBrowserClient();
  const transport = getLiveTransport(orgId, userId);
  if (!supabase || !transport) return null;
  store = { key, value: new CallStore(supabase, getInboxStore(transport), userId, orgId, available) };
  // Buttons that rendered before the call layer mounted pick the store up now.
  queueMicrotask(() => registry.forEach((listener) => listener()));
  return store.value;
}

/** The call store created by the app's call layer, for call buttons anywhere (null until it exists). */
export function useCurrentCallStore(): CallStore | null {
  return useSyncExternalStore(
    (listener) => {
      registry.add(listener);
      return () => registry.delete(listener);
    },
    () => store?.value ?? null,
    () => null,
  );
}

export function useCallSnapshot(callStore: CallStore | null): CallSnapshot | null {
  useEffect(() => callStore?.retain(), [callStore]);
  return useSyncExternalStore(callStore?.subscribe ?? noop, callStore?.getSnapshot ?? nothing, nothing);
}

const noop = () => () => {};
const nothing = () => null;
