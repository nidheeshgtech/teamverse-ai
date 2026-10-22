"use client";

import { Headphones, Maximize2, Mic, MicOff, Minimize2, MonitorUp, Phone, PhoneOff, RefreshCcw, ShieldCheck, Video, VideoOff, Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Track } from "livekit-client";
import { getCallStore, useCallSnapshot, type CallSnapshot, type CallStore, type ParticipantView } from "@/features/calls/call-store";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { useConversationNames } from "./use-conversation-names";

export type CallPerson = { userId: string; displayName: string; avatarUrl: string | null; title: string | null };

type Props = { orgId: string; viewerId: string; available: boolean; people: CallPerson[] };

// Stitch "Executive Boardroom — Live Audio/Video Conference" (stage, tile strip, control bar).
// DESIGN DEVIATIONS: "E2EE Active" → "Encrypted in transit" (LiveKit is not end-to-end encrypted);
// node/latency/loss/bandwidth readouts → LiveKit's real connection-quality indicator; the AI
// "Intelligence Sidecar", raise hand, reactions and "Simultaneous AR Dub" are omitted (Phase 6 /
// not in spec). Incoming-call card, ringing, ended and minimized states are DESIGN GAPs.
export function CallLayer({ orgId, viewerId, available, people }: Props) {
  const store = getCallStore(orgId, viewerId, available);
  const snap = useCallSnapshot(store);
  const byId = useMemo(() => new Map(people.map((p) => [p.userId, p])), [people]);
  const nameOf = useCallback((id: string) => byId.get(id)?.displayName ?? "", [byId]);
  const conversationName = useConversationNames(orgId, viewerId, nameOf);
  if (!store || !snap || snap.phase === "idle") return null;

  const conversationId = snap.call?.conversation_id;
  const title = conversationId ? { kind: "huddle" as const, name: conversationName(conversationId) } : { kind: "direct" as const, name: nameOf(snap.peerIds[0] ?? "") };

  if (snap.phase === "incoming") return <IncomingCall store={store} snap={snap} person={byId.get(snap.peerIds[0] ?? "")} />;
  if (snap.minimized) return <MiniCall store={store} snap={snap} title={title} />;
  return <CallScreen store={store} snap={snap} title={title} viewerId={viewerId} byId={byId} />;
}

// ---- incoming ------------------------------------------------------------------------------------
function IncomingCall({ store, snap, person }: { store: CallStore; snap: CallSnapshot; person: CallPerson | undefined }) {
  const t = useTranslations("calls");
  const name = person?.displayName ?? "";
  const video = snap.kind === "video";
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label={`${video ? t("incomingVideo") : t("incomingAudio")}: ${name}`}
      className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[95] flex flex-col gap-4 rounded-xl border border-glass-line bg-surface-container-high p-4 shadow-level-3 sm:inset-x-auto sm:end-6 sm:top-auto sm:bottom-6 sm:w-[24rem]"
    >
      <div className="flex items-center gap-4">
        <span className="relative shrink-0">
          <span aria-hidden className="absolute inset-0 rounded-lg bg-primary-container/40 motion-safe:animate-ping" />
          <Avatar name={name} src={person?.avatarUrl} size="md" decorative />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate type-title-md text-on-surface">{name}</p>
          <p className="type-body-sm text-on-surface-variant">{video ? t("incomingVideo") : t("incomingAudio")}</p>
        </div>
      </div>
      <div className="flex gap-2 [&>button]:flex-1">
        <PillButton danger onClick={() => void store.decline()} icon={<PhoneOff />} label={t("decline")} />
        {video ? (
          <>
            <PillButton onClick={() => void store.accept(false)} icon={<Phone />} label={t("acceptAudioOnly")} />
            <PillButton primary onClick={() => void store.accept(true)} icon={<Video />} label={t("acceptVideo")} />
          </>
        ) : (
          <PillButton primary onClick={() => void store.accept(false)} icon={<Phone />} label={t("accept")} />
        )}
      </div>
    </div>
  );
}

// ---- full call screen ----------------------------------------------------------------------------
function CallScreen({ store, snap, title, viewerId, byId }: { store: CallStore; snap: CallSnapshot; title: { kind: "huddle" | "direct"; name: string }; viewerId: string; byId: Map<string, CallPerson> }) {
  const t = useTranslations("calls");
  const nameOf = (id: string) => (id === viewerId ? t("you") : (byId.get(id)?.displayName ?? ""));
  const remote = snap.participants.filter((p) => !p.isLocal);
  const local = snap.participants.find((p) => p.isLocal);
  const sharer = [...remote, ...(local ? [local] : [])].find((p) => p.screenTrack);
  const ended = snap.phase === "ended";
  const ringing = snap.phase === "outgoing";
  // While ringing the stage shows who I'm calling; my own preview goes to the tile strip.
  const featured = ringing ? undefined : (sharer ?? remote.find((p) => p.speaking) ?? remote[0] ?? local);
  const heading = title.kind === "huddle" ? t("huddleIn", { name: title.name }) : t("callWith", { name: title.name });
  const canShare = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      className="fixed inset-0 z-[90] flex flex-col gap-3 bg-surface-canvas/97 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:gap-4 md:p-6"
    >
      <header className="glass-level-1 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-3">
        <StatusPill snap={snap} />
        <h2 className="min-w-0 flex-1 truncate type-title-md text-on-surface md:type-headline-md">{heading}</h2>
        {snap.connectedAt && !ended && !ringing ? <Timer since={snap.connectedAt} /> : null}
        {local ? <QualityBadge quality={local.quality} /> : null}
        <Badge tone="secondary" title={t("encryptedHint")} className="max-sm:hidden">
          <ShieldCheck aria-hidden className="size-3.5" />
          {t("encrypted")}
        </Badge>
        {!ended ? (
          <button type="button" onClick={() => store.setMinimized(true)} aria-label={t("minimize")} className={iconButton}>
            <Minimize2 aria-hidden className="size-5" />
          </button>
        ) : null}
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-glass-line bg-surface-container-lowest">
        {ended ? (
          <EndedCard store={store} snap={snap} name={title.name} />
        ) : featured && (featured.screenTrack || featured.cameraTrack) ? (
          <>
            <TrackVideo track={(featured.screenTrack ?? featured.cameraTrack)!} mirror={featured.isLocal && !featured.screenTrack} contain={Boolean(featured.screenTrack)} />
            <StageLabel muted={!featured.screenTrack && !featured.micOn ? t("muted") : null}>{featured.screenTrack ? (featured.isLocal ? t("youAreSharing") : t("isSharing", { name: nameOf(featured.identity) })) : nameOf(featured.identity)}</StageLabel>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            {ringing || remote.length === 0 ? (
              <>
                <span className="relative">
                  {ringing ? <span aria-hidden className="absolute inset-0 rounded-xl bg-primary-container/30 motion-safe:animate-ping" /> : null}
                  {title.kind === "huddle" ? (
                    <span aria-hidden className="inline-flex size-28 items-center justify-center rounded-xl border border-primary-container/40 bg-surface-container-high text-primary">
                      <Headphones className="size-10" />
                    </span>
                  ) : (
                    <Avatar name={title.name} src={byId.get(snap.peerIds[0] ?? "")?.avatarUrl} size="xl" decorative />
                  )}
                </span>
                <p className="type-body-md text-on-surface-variant" aria-live="polite">
                  {ringing ? t("waitingFor", { name: title.name }) : snap.phase === "connecting" ? t("connecting") : t("alone")}
                </p>
              </>
            ) : (
              <>
                <span className={cn("rounded-xl ring-offset-4 ring-offset-surface-container-lowest transition-shadow", featured?.speaking && "ring-2 ring-primary-container")}>
                  <Avatar name={nameOf(featured!.identity)} src={byId.get(featured!.identity)?.avatarUrl} size="xl" decorative />
                </span>
                <p className="inline-flex items-center gap-2 type-headline-md text-on-surface">
                  {nameOf(featured!.identity)}
                  {!featured!.micOn ? <MicOff aria-label={t("muted")} className="size-5 text-error" /> : null}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {!ended && (snap.participants.length > 1 || (ringing && local?.cameraTrack)) ? (
        <ul aria-label={t("live")} className="flex shrink-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {snap.participants
            .filter((p) => p !== featured || Boolean(featured?.screenTrack))
            .map((p) => (
              <li key={p.identity}>
                <Tile participant={p} name={nameOf(p.identity)} avatarUrl={byId.get(p.identity)?.avatarUrl ?? null} />
              </li>
            ))}
        </ul>
      ) : null}

      {snap.issues.length ? (
        <div role="status" className="flex flex-wrap items-center justify-center gap-2 rounded-lg bg-tertiary-container/15 px-4 py-2 type-body-sm text-tertiary">
          {snap.issues.map((issue) => (
            <span key={issue}>{t(`issues.${issue}`)}</span>
          ))}
          {snap.issues.includes("audio_blocked") ? (
            <button type="button" onClick={() => void store.enableAudio()} className="inline-flex items-center gap-1 rounded-md bg-tertiary-container/30 px-2 py-1 font-semibold">
              <Volume2 aria-hidden className="size-4" />
              {t("enableAudio")}
            </button>
          ) : null}
        </div>
      ) : null}

      {!ended ? (
        <div className="glass-level-2 flex shrink-0 flex-wrap items-center justify-center gap-2 rounded-xl p-3 md:gap-3">
          <ControlButton
            active={!snap.micOn}
            onClick={() => void store.toggleMic()}
            label={snap.micOn ? t("mute") : t("unmute")}
            icon={snap.micOn ? <Mic /> : <MicOff />}
            extra={snap.micOn ? <LevelMeter level={local?.level ?? 0} label={t("micLevel")} /> : null}
          />
          <ControlButton active={snap.cameraOn} onClick={() => void store.toggleCamera()} label={snap.cameraOn ? t("cameraOff") : t("cameraOn")} icon={snap.cameraOn ? <Video /> : <VideoOff />} />
          {snap.cameraOn ? <ControlButton onClick={() => void store.switchCamera()} label={t("switchCamera")} icon={<RefreshCcw />} compact /> : null}
          {!ringing ? (
            <ControlButton
              active={snap.screenOn}
              disabled={!canShare}
              title={canShare ? undefined : t("shareUnsupported")}
              onClick={() => void store.toggleScreenShare()}
              label={snap.screenOn ? t("stopSharing") : t("shareScreen")}
              icon={<MonitorUp />}
            />
          ) : null}
          <button
            type="button"
            onClick={() => void store.hangup()}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-error px-4 type-label-lg md:px-5 font-semibold text-on-error transition-[filter] hover:brightness-110 focus-visible:shadow-focus-ring focus-visible:outline-none"
          >
            <PhoneOff aria-hidden className="size-5" />
            <span className="max-md:sr-only">{ringing ? t("cancel") : t("leave")}</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}

function EndedCard({ store, snap, name }: { store: CallStore; snap: CallSnapshot; name: string }) {
  const t = useTranslations("calls");
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="flex max-w-md flex-col items-center gap-4 p-6 text-center">
      <span aria-hidden className="inline-flex size-14 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
        <PhoneOff className="size-6" />
      </span>
      <p role="status" className="type-title-md text-on-surface">
        {t(`ended.${snap.endReason ?? "hangup"}`, { name })}
      </p>
      <button ref={ref} type="button" onClick={() => store.dismiss()} className="rounded-md bg-surface-container-high px-4 py-2 type-label-lg text-on-surface hover:bg-surface-container-highest focus-visible:shadow-focus-ring focus-visible:outline-none">
        {t("close")}
      </button>
    </div>
  );
}

// ---- minimized -----------------------------------------------------------------------------------
function MiniCall({ store, snap, title }: { store: CallStore; snap: CallSnapshot; title: { kind: "huddle" | "direct"; name: string } }) {
  const t = useTranslations("calls");
  return (
    <div className="glass-level-3 fixed end-4 bottom-[calc(var(--chrome-bottom)+0.75rem)] z-[85] flex items-center gap-2 rounded-full py-1.5 ps-4 pe-1.5 shadow-level-3">
      <span aria-hidden className="size-2 rounded-full bg-presence-online motion-safe:animate-pulse" />
      <span className="max-w-40 truncate type-label-lg text-on-surface">{title.kind === "huddle" ? t("huddleIn", { name: title.name }) : title.name}</span>
      {snap.connectedAt ? <Timer since={snap.connectedAt} /> : null}
      <button type="button" onClick={() => void store.toggleMic()} aria-label={snap.micOn ? t("mute") : t("unmute")} className={iconButton}>
        {snap.micOn ? <Mic aria-hidden className="size-4.5" /> : <MicOff aria-hidden className="size-4.5 text-error" />}
      </button>
      <button type="button" onClick={() => store.setMinimized(false)} aria-label={t("restore")} className={iconButton}>
        <Maximize2 aria-hidden className="size-4.5" />
      </button>
      <button type="button" onClick={() => void store.hangup()} aria-label={t("leave")} className="inline-flex size-9 items-center justify-center rounded-full bg-error text-on-error">
        <PhoneOff aria-hidden className="size-4.5" />
      </button>
    </div>
  );
}

// ---- pieces --------------------------------------------------------------------------------------
const iconButton =
  "inline-flex size-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:shadow-focus-ring focus-visible:outline-none";

function StatusPill({ snap }: { snap: CallSnapshot }) {
  const t = useTranslations("calls");
  const label =
    snap.phase === "outgoing" ? t("calling") : snap.phase === "connecting" ? t("connecting") : snap.phase === "reconnecting" ? t("reconnecting") : snap.phase === "ended" ? t("endedTag") : t("live");
  const live = snap.phase === "active";
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-2.5 py-1 type-label-xs uppercase tracking-[0.08em]", live ? "bg-primary-container/15 text-primary" : "bg-surface-container-high text-on-surface-variant")}>
      <span aria-hidden className={cn("size-2 rounded-full", live ? "bg-presence-online motion-safe:animate-pulse" : "bg-outline")} />
      {label}
    </span>
  );
}

function Timer({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  const text = `${Math.floor(seconds / 3600) ? `${Math.floor(seconds / 3600)}:` : ""}${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <span className="type-code-sm tabular-nums text-on-surface-variant">{text}</span>;
}

function QualityBadge({ quality }: { quality: ParticipantView["quality"] }) {
  const t = useTranslations("calls");
  const bars = quality === "excellent" ? 3 : quality === "good" ? 2 : quality === "poor" ? 1 : 0;
  return (
    <span role="img" aria-label={t(`quality.${quality}`)} title={t(`quality.${quality}`)} className="inline-flex h-4 items-end gap-0.5">
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn("w-1 rounded-sm", i <= bars ? (bars === 1 ? "bg-tertiary" : "bg-primary") : "bg-outline-variant")} style={{ height: `${i * 33}%` }} />
      ))}
    </span>
  );
}

function LevelMeter({ level, label }: { level: number; label: string }) {
  const bars = Math.round(Math.min(1, level * 3) * 5);
  return (
    <span role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={5} aria-valuenow={bars} className="inline-flex h-4 items-end gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("w-0.5 rounded-sm transition-[height,background-color] duration-150", i <= bars ? "bg-primary" : "bg-outline-variant")} style={{ height: `${30 + i * 14}%` }} />
      ))}
    </span>
  );
}

function ControlButton({ icon, label, onClick, active = false, disabled = false, compact = false, title, extra }: { icon: ReactNode; label: string; onClick: () => void; active?: boolean; disabled?: boolean; compact?: boolean; title?: string; extra?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={title ?? label}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-full border px-4 type-label-lg transition-colors duration-150 focus-visible:shadow-focus-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-5",
        active ? "border-primary-container/50 bg-primary-container/15 text-primary" : "border-glass-line bg-surface-container-low text-on-surface hover:bg-surface-container-high",
        compact && "px-3",
      )}
    >
      <span aria-hidden>{icon}</span>
      <span className={cn(compact ? "sr-only" : "max-md:sr-only")}>{label}</span>
      {extra}
    </button>
  );
}

function PillButton({ icon, label, onClick, primary = false, danger = false }: { icon: ReactNode; label: string; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-full px-3 type-label-lg whitespace-nowrap focus-visible:shadow-focus-ring focus-visible:outline-none [&_svg]:size-4.5",
        primary
          ? "bg-primary-container font-semibold text-on-primary-action hover:shadow-glow-primary"
          : danger
            ? "bg-error font-semibold text-on-error hover:brightness-110"
            : "border border-glass-line bg-surface-container-low text-on-surface hover:bg-surface-container",
      )}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );
}

function StageLabel({ children, muted }: { children: ReactNode; muted: string | null }) {
  return (
    <span className="absolute start-3 bottom-3 inline-flex items-center gap-1.5 rounded-md bg-surface-canvas/80 px-3 py-1.5 type-label-md text-on-surface backdrop-blur-md">
      {muted ? <MicOff aria-label={muted} className="size-4 text-error" /> : null}
      {children}
    </span>
  );
}

function Tile({ participant, name, avatarUrl }: { participant: ParticipantView; name: string; avatarUrl: string | null }) {
  const t = useTranslations("calls");
  const track = participant.cameraTrack;
  return (
    <div
      className={cn(
        "relative flex h-24 w-40 items-center justify-center overflow-hidden rounded-lg border bg-surface-container-low transition-[border-color] duration-150 sm:h-28 sm:w-48",
        participant.speaking ? "border-primary-container" : "border-glass-line",
      )}
    >
      {track ? <TrackVideo track={track} mirror={participant.isLocal} /> : <Avatar name={name} src={avatarUrl} size="md" decorative />}
      <span className="absolute inset-x-1.5 bottom-1.5 flex items-center gap-1 truncate rounded bg-surface-canvas/75 px-1.5 py-0.5 type-label-xs text-on-surface">
        {!participant.micOn ? <MicOff aria-label={t("muted")} className="size-3.5 shrink-0 text-error" /> : null}
        <span className="truncate">{name}</span>
      </span>
    </div>
  );
}

/** Attaches a LiveKit video track to a <video> element for as long as it is shown. */
function TrackVideo({ track, mirror = false, contain = false }: { track: Track; mirror?: boolean; contain?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);
  return <video ref={ref} autoPlay playsInline muted className={cn("size-full", contain ? "object-contain" : "object-cover", mirror && "-scale-x-100")} />;
}
