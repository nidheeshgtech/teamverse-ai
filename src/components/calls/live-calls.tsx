"use client";

import { Headphones, MessagesSquare, Phone, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { useCallSnapshot, useCurrentCallStore } from "@/features/calls/call-store";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Panel, PanelEyebrow } from "@/ui/panel";
import { StateMessage } from "@/ui/states";
import type { CallPerson } from "./call-layer";
import { useConversationNames } from "./use-conversation-names";

/** Conferences page: the call I'm in plus live huddles in my conversations, joinable in one click. */
export function LiveCalls({ orgId, viewerId, people }: { orgId: string; viewerId: string; people: CallPerson[] }) {
  const t = useTranslations("calls");
  const store = useCurrentCallStore();
  const snap = useCallSnapshot(store);
  const byId = useMemo(() => new Map(people.map((p) => [p.userId, p])), [people]);
  const nameOf = useCallback((id: string) => byId.get(id)?.displayName ?? "", [byId]);
  const conversationName = useConversationNames(orgId, viewerId, nameOf);

  if (!snap) return null;
  const inCall = snap.phase !== "idle" && snap.phase !== "ended";
  const current = inCall ? snap.call : null;
  const huddles = [...snap.huddles.values()].filter((h) => h.id !== current?.id);

  return (
    <div className="flex flex-col gap-space-md">
      {!snap.available ? (
        <Panel level={1} padding="md" role="status" className="type-body-md text-on-surface-variant">
          {t("unavailable")}
        </Panel>
      ) : null}

      {current ? (
        <Panel level={2} padding="lg" className="flex flex-wrap items-center gap-space-md">
          <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-lg bg-primary-container/15 text-primary [&_svg]:size-5">
            {current.kind === "video" ? <Video /> : <Phone />}
          </span>
          <div className="min-w-0 flex-1">
            <PanelEyebrow>{t("live")}</PanelEyebrow>
            <p className="mt-1 truncate type-title-md text-on-surface">
              {current.conversation_id ? t("huddleIn", { name: conversationName(current.conversation_id) }) : t("callWith", { name: nameOf(snap.peerIds[0] ?? "") })}
            </p>
          </div>
          <Button variant="primary" onClick={() => store?.setMinimized(false)}>
            {t("restore")}
          </Button>
        </Panel>
      ) : null}

      <section aria-labelledby="live-title" className="flex flex-col gap-space-sm">
        <h2 id="live-title" className="type-title-md text-on-surface">{t("page.liveTitle")}</h2>
        {huddles.length === 0 ? (
          <Panel level={1} padding="lg">
            <StateMessage titleAs="p" icon={<Headphones />} title={t("page.none")} description={t("page.subtitle")} />
          </Panel>
        ) : (
          <ul className="grid gap-space-sm md:grid-cols-2 2xl:grid-cols-3">
            {huddles.map((h) => {
              const joined = h.participants.filter((p) => p.status === "joined");
              const name = conversationName(h.conversation_id!);
              return (
                <li key={h.id}>
                  <Panel level={2} padding="md" className="flex h-full flex-col gap-space-sm">
                    <div className="flex items-start gap-space-sm">
                      <span aria-hidden className="mt-0.5 size-2 shrink-0 rounded-full bg-presence-online motion-safe:animate-pulse" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate type-label-lg font-semibold text-on-surface">{name}</p>
                        <p className="type-body-sm text-on-surface-variant">{t("huddleLive", { count: joined.length })}</p>
                      </div>
                      <Badge>{h.kind === "video" ? t("camera") : t("page.huddle")}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {joined.slice(0, 6).map((p) => (
                        <Avatar key={p.user_id} name={nameOf(p.user_id)} src={byId.get(p.user_id)?.avatarUrl} size="sm" />
                      ))}
                    </div>
                    <div className="mt-auto flex flex-wrap gap-space-xs">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={inCall || !snap.available}
                        title={inCall ? t("inAnotherCall") : undefined}
                        onClick={() => void store?.startHuddle(h.conversation_id!, h.kind)}
                      >
                        <Headphones aria-hidden />
                        {t("page.join")}
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/comms/${h.conversation_id}`}>
                          <MessagesSquare aria-hidden />
                          {t("page.openChannel")}
                        </Link>
                      </Button>
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
