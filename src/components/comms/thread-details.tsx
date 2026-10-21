"use client";

import { LogOut, Mic, MonitorUp, Phone, ShieldCheck, Video } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import type { ConversationDetail } from "@/features/messaging/model";
import type { ThreadMessage } from "@/features/messaging/thread-state";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { FieldError } from "@/ui/input";
import { PanelEyebrow } from "@/ui/panel";
import { PresenceDot } from "@/ui/presence";
import { departmentTone, useDepartmentLabel } from "../office/use-labels";
import { AttachmentList } from "./attachment-view";
import { useComms } from "./comms-context";

type Props = { detail: ConversationDetail; messages: ThreadMessage[]; onLeft: () => void; variant?: "panel" | "sheet" };

// Stitch Communications › right column (profile card, contact grid, SHARED ASSETS).
// DESIGN DEVIATIONS: "Spatial Presence · Synchronized / seated in Dubai VIP Executive Suite" and
// "GCC Sovereign Telemetry" removed (no location tracking; unverifiable claims) → honest privacy note;
// "DIFC Node" chip → department; contact actions disabled until Phases 4–5; "View Vault" omitted.
export function ThreadDetails({ detail, messages, onLeft, variant = "panel" }: Props) {
  const t = useTranslations();
  const { viewerId, transport, store } = useComms();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState(false);
  const other = detail.kind === "direct" ? detail.members.find((m) => m.userId !== viewerId)?.userId : undefined;

  const files = useMemo(() => messages.filter((m) => !m.deleted_at).flatMap((m) => m.attachments).reverse(), [messages]);

  const leave = async () => {
    setLeaving(true);
    setError(false);
    try {
      await transport.leaveConversation(detail.id);
      await store.reload();
      onLeft();
    } catch {
      setError(true);
      setLeaving(false);
    }
  };

  return (
    <aside
      aria-label={t("comms.details.label")}
      className={cn(
        "flex flex-col gap-space-lg",
        variant === "panel" ? "w-[22rem] shrink-0 overflow-y-auto border-s border-glass-line bg-surface-panel/60 p-space-lg" : "pt-space-xs",
      )}
    >
      {other ? <PersonCard userId={other} /> : <MembersCard detail={detail} />}

      <section aria-labelledby="files-title" className="flex flex-col gap-space-xs">
        <PanelEyebrow id="files-title">{t("comms.details.files", { count: files.length })}</PanelEyebrow>
        {files.length ? (
          <>
            <AttachmentList attachments={files.slice(0, 12)} />
            <p className="type-label-xs text-outline">{t("comms.details.filesLoaded")}</p>
          </>
        ) : (
          <p className="type-body-sm text-on-surface-variant">{t("comms.details.noFiles")}</p>
        )}
      </section>

      <section aria-labelledby="privacy-title" className="flex flex-col gap-space-xs rounded-lg bg-surface-container-low/70 p-space-md">
        <h2 id="privacy-title" className="flex items-center gap-space-xs type-label-lg text-on-surface">
          <ShieldCheck aria-hidden className="size-4 text-secondary" />
          {t("comms.details.privacyTitle")}
        </h2>
        <p className="type-body-sm text-on-surface-variant">{t("comms.details.privacyNote")}</p>
        <p className="type-body-sm text-on-surface-variant">{t("comms.details.receiptsNote")}</p>
      </section>

      {detail.kind !== "direct" ? (
        <div className="flex flex-col gap-space-xs">
          <Button variant="ghost" size="sm" disabled={leaving} onClick={() => void leave()} className="self-start text-destructive-text hover:bg-destructive-fill hover:text-destructive-text">
            <LogOut aria-hidden className="icon-directional" />
            {detail.kind === "channel" ? t("comms.details.leaveChannel") : t("comms.details.leaveGroup")}
          </Button>
          {error ? <FieldError>{t("comms.thread.actionFailed")}</FieldError> : null}
        </div>
      ) : null}
    </aside>
  );
}

function PersonCard({ userId }: { userId: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const deptLabel = useDepartmentLabel();
  const { people, personName, statusOf } = useComms();
  const person = people.get(userId);
  const status = statusOf(userId);
  const name = personName(userId);
  const localTime = person ? format.dateTime(new Date(), { timeZone: person.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : null;

  return (
    <section aria-labelledby="person-title" className="flex flex-col items-center gap-space-sm text-center">
      <Avatar name={name} src={person?.avatarUrl} size="xl" status={status} statusLabel={t(`presence.${status}`)} />
      <div>
        <h2 id="person-title" className="type-headline-md text-on-surface">{name}</h2>
        {person?.title ? <p className="type-label-lg text-primary">{person.title}</p> : null}
      </div>
      <div className="flex flex-wrap justify-center gap-space-xs">
        {localTime ? <Badge>{t("comms.details.localTime", { time: localTime })}</Badge> : null}
        {person?.departmentSlug ? <Badge tone={departmentTone(person.departmentSlug)}>{deptLabel(person.departmentSlug)}</Badge> : null}
      </div>
      <p className="flex items-center gap-space-xs type-label-md text-on-surface-variant">
        <PresenceDot status={status} />
        {t(`presence.${status}`)}
      </p>

      <div className="mt-space-xs grid w-full grid-cols-2 gap-space-xs" aria-label={t("comms.details.contact")} role="group">
        <ContactTile icon={<Phone />} label={t("comms.details.directCall")} hint={t("comms.thread.phaseHint", { phase: 4 })} />
        <ContactTile icon={<Video />} label={t("comms.details.videoCall")} hint={t("comms.thread.phaseHint", { phase: 4 })} />
        <ContactTile icon={<MonitorUp />} label={t("comms.details.screenShare")} hint={t("office.profile.screenShareHint")} />
        <ContactTile icon={<Mic />} label={t("comms.details.voiceNote")} hint={t("comms.thread.phaseHint", { phase: 5 })} />
      </div>
    </section>
  );
}

function MembersCard({ detail }: { detail: ConversationDetail }) {
  const t = useTranslations();
  const { personName, people, statusOf, viewerId } = useComms();
  const members = [...detail.members].sort((a, b) => (a.role === b.role ? personName(a.userId).localeCompare(personName(b.userId)) : a.role === "owner" ? -1 : 1));

  return (
    <>
      <section aria-labelledby="about-title" className="flex flex-col gap-space-xs">
        <PanelEyebrow id="about-title">{t("comms.details.about")}</PanelEyebrow>
        <p className="type-body-md text-on-surface">{detail.topic ?? t("comms.details.noTopic")}</p>
      </section>
      <section aria-labelledby="members-title" className="flex flex-col gap-space-xs">
        <PanelEyebrow id="members-title">{t("comms.details.membersTitle", { count: members.length })}</PanelEyebrow>
        <ul className="flex flex-col gap-space-2xs">
          {members.map((m) => {
            const status = statusOf(m.userId);
            return (
              <li key={m.userId} className="flex items-center gap-space-sm py-space-2xs">
                <Avatar name={personName(m.userId)} src={people.get(m.userId)?.avatarUrl} size="sm" status={status} statusLabel={t(`presence.${status}`)} />
                <span className="min-w-0 flex-1 truncate type-label-lg text-on-surface">
                  {personName(m.userId)}
                  {m.userId === viewerId ? <span className="text-on-surface-variant"> ({t("comms.you")})</span> : null}
                </span>
                {m.role === "owner" ? <Badge tone="secondary">{t("comms.details.owner")}</Badge> : null}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function ContactTile({ icon, label, hint }: { icon: ReactNode; label: string; hint: string }) {
  return (
    <button
      type="button"
      aria-disabled
      title={hint}
      className="flex cursor-not-allowed flex-col items-center gap-space-2xs rounded-md bg-surface-container-low px-space-xs py-space-sm text-on-surface-variant [&_svg]:size-5"
    >
      <span aria-hidden>{icon}</span>
      <span className="type-label-md text-on-surface">{label}</span>
      <span className="type-label-xs">{hint}</span>
    </button>
  );
}
