"use client";

import { useTranslations } from "next-intl";
import { useCallSnapshot, useCurrentCallStore } from "@/features/calls/call-store";
import type { CallKind } from "@/features/calls/model";

/**
 * Call buttons anywhere in the app. `blocked` is null when a call can start, otherwise the reason
 * to show (calls not configured, already in a call). `store` is null without a backend (preview).
 */
export function useCallActions() {
  const t = useTranslations("calls");
  const store = useCurrentCallStore();
  const snap = useCallSnapshot(store);
  const inCall = Boolean(snap && snap.phase !== "idle" && snap.phase !== "ended");
  const blocked = !snap ? null : !snap.available ? t("unavailable") : inCall ? t("inAnotherCall") : null;
  return {
    ready: Boolean(store && snap),
    blocked,
    huddles: snap?.huddles ?? new Map(),
    activeConversationId: inCall ? (snap?.call?.conversation_id ?? null) : null,
    startCall: (peerId: string, kind: CallKind) => void store?.startCall(peerId, kind),
    startHuddle: (conversationId: string, kind: CallKind = "audio") => void store?.startHuddle(conversationId, kind),
    restore: () => store?.setMinimized(false),
  };
}
