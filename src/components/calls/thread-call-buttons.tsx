"use client";

import { Headphones, Phone, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConversationKind } from "@/features/messaging/model";
import { Button } from "@/ui/button";
import { useCallActions } from "./use-call-actions";

const joinedCount = (call: { participants: { status: string }[] }) => call.participants.filter((p) => p.status === "joined").length;

/** Thread header: voice/video for a DM, huddle for channels and groups. Disabled with a reason when calls can't start. */
export function ThreadCallButtons({ kind, conversationId, otherId }: { kind: ConversationKind; conversationId: string; otherId?: string }) {
  const t = useTranslations();
  const calls = useCallActions();

  if (!calls.ready) {
    // Preview without a backend: visible, honest, disabled.
    return (
      <Button size="sm" variant="glass" aria-disabled title={t("office.profile.previewHint")} className="cursor-not-allowed opacity-50 max-sm:size-10 max-sm:px-0" onClick={(e) => e.preventDefault()}>
        {kind === "direct" ? <Phone aria-hidden /> : <Headphones aria-hidden />}
        <span className="max-sm:hidden">{kind === "direct" ? t("calls.startVoice") : t("comms.thread.huddle")}</span>
      </Button>
    );
  }

  const disabledProps = (reason: string | null) =>
    reason ? { "aria-disabled": true, title: reason, className: "cursor-not-allowed opacity-50", onClick: (e: React.MouseEvent) => e.preventDefault() } : {};

  if (kind === "direct") {
    if (!otherId) return null;
    return (
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" aria-label={t("calls.startVoice")} title={calls.blocked ?? t("calls.startVoice")} onClick={() => calls.startCall(otherId, "audio")} {...disabledProps(calls.blocked)}>
          <Phone aria-hidden />
        </Button>
        <Button size="icon" variant="ghost" aria-label={t("calls.startVideo")} title={calls.blocked ?? t("calls.startVideo")} onClick={() => calls.startCall(otherId, "video")} {...disabledProps(calls.blocked)}>
          <Video aria-hidden />
        </Button>
      </div>
    );
  }

  const huddle = calls.huddles.get(conversationId);
  if (calls.activeConversationId === conversationId) {
    return (
      <Button size="sm" variant="primary" onClick={calls.restore} className="max-sm:size-10 max-sm:px-0">
        <Headphones aria-hidden />
        <span className="max-sm:hidden">{t("calls.restore")}</span>
      </Button>
    );
  }
  // Stitch "Huddle (3)": the count of people in a live huddle; the banner below carries the Join call-to-action.
  const label = huddle ? `${t("calls.joinHuddle")} — ${t("calls.huddleLive", { count: joinedCount(huddle) })}` : t("calls.startHuddle");
  return (
    <Button
      size="sm"
      variant="glass"
      aria-label={label}
      title={calls.blocked ?? label}
      onClick={() => calls.startHuddle(conversationId, huddle?.kind ?? "audio")}
      {...disabledProps(calls.blocked)}
      className={`max-sm:size-10 max-sm:px-0 ${calls.blocked ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {huddle ? <span aria-hidden className="size-2 rounded-full bg-presence-online motion-safe:animate-pulse max-sm:hidden" /> : null}
      <Headphones aria-hidden />
      <span className="max-sm:hidden">{huddle ? `${t("comms.thread.huddle")} (${joinedCount(huddle)})` : t("comms.thread.huddle")}</span>
    </Button>
  );
}

/** Banner under the thread header while a huddle is live in this conversation and I'm not in it. */
export function HuddleBanner({ conversationId }: { conversationId: string }) {
  const t = useTranslations("calls");
  const calls = useCallActions();
  const huddle = calls.huddles.get(conversationId);
  if (!calls.ready || !huddle || calls.activeConversationId === conversationId) return null;
  return (
    <div role="status" className="flex items-center gap-3 border-b border-glass-line bg-primary-container/10 px-space-md py-2 lg:px-space-lg">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-presence-online motion-safe:animate-pulse" />
      <p className="min-w-0 flex-1 truncate type-body-sm text-on-surface">{t("huddleLive", { count: joinedCount(huddle) })}</p>
      <Button size="sm" variant="primary" disabled={Boolean(calls.blocked)} title={calls.blocked ?? undefined} onClick={() => calls.startHuddle(conversationId, huddle.kind)}>
        {t("joinHuddle")}
      </Button>
    </div>
  );
}
