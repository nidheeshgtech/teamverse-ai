"use client";

import { CalendarPlus, LocateFixed, MessageSquare, Mic, MonitorUp, Phone, Video, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import type { Occupant } from "@/features/office/model";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Panel, PanelEyebrow } from "@/ui/panel";
import { PresenceDot } from "@/ui/presence";
import { departmentTone, useDepartmentLabel } from "./use-labels";

type Props = {
  person: Occupant;
  isSelf: boolean;
  canFocusDesk: boolean;
  onFocusDesk: () => void;
  onClose: () => void;
  /** Opens a DM with this person; omitted in previews without a backend. */
  onMessage?: (userId: string) => Promise<boolean>;
  /** "sheet": rendered inside a bottom sheet (phones), which provides the card and close button. */
  variant?: "panel" | "sheet";
};

// Stitch "Target Focus" panel. DESIGN DEVIATIONS: no verified tick, "Active Work Stream" or
// "Shared in Workspace" (no productivity data); "Spatial Proximity" replaced by desk label.
export function ProfilePanel({ person, isSelf, canFocusDesk, onFocusDesk, onClose, onMessage, variant = "panel" }: Props) {
  const t = useTranslations();
  const [messaging, setMessaging] = useState<"idle" | "pending" | "failed">("idle");
  const format = useFormatter();
  const deptLabel = useDepartmentLabel();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const localTime = format.dateTime(new Date(), { timeZone: person.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const place = person.seat ? t("office.desk", { label: person.seat.label }) : t("office.noDesk");

  return (
    <Panel
      level={variant === "sheet" ? 3 : 2}
      padding={variant === "sheet" ? "none" : "lg"}
      aria-label={t("office.profile.label", { name: person.displayName })}
      className={cn("flex flex-col gap-space-md", variant === "sheet" && "bg-transparent shadow-none backdrop-blur-none")}
    >
      <div className={cn("flex items-start justify-between", variant === "sheet" && "hidden")}>
        <PanelEyebrow>{person.seat?.label ?? t("office.noDesk")}</PanelEyebrow>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("office.profile.close")}
          className="-m-space-xs inline-flex size-8 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-space-md">
        <Avatar name={person.displayName} src={person.avatarUrl} size="lg" status={person.status} statusLabel={t(`presence.${person.status}`)} />
        <div className="min-w-0">
          <h2 className="truncate type-headline-md text-on-surface">{person.displayName}</h2>
          {person.title ? <p className="truncate type-label-lg text-on-surface-variant">{person.title}</p> : null}
          <div className="mt-space-2xs flex flex-wrap items-center gap-space-xs">
            {person.departmentSlug ? <Badge tone={departmentTone(person.departmentSlug)}>{deptLabel(person.departmentSlug)}</Badge> : null}
            <span className="type-code-sm text-on-surface-variant">{t("office.profile.localTime", { time: localTime })}</span>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-space-sm rounded-md bg-surface-container-low px-space-sm py-space-xs type-label-lg text-on-surface">
        <PresenceDot status={person.status} />
        {person.status === "offline" ? t("office.profile.notConnected") : t(`presence.${person.status}`)} · {place}
      </p>

      {isSelf ? (
        <p className="type-body-md text-on-surface-variant">{t("office.profile.you")}</p>
      ) : (
        <section aria-labelledby="contact-title">
          <PanelEyebrow id="contact-title">{t("office.profile.actionsTitle")}</PanelEyebrow>
          {/* Actions arrive in later phases; shown disabled with the reason instead of pretending to work. */}
          <div className="mt-space-sm grid grid-cols-3 gap-space-xs">
            {onMessage ? (
              <button
                type="button"
                disabled={messaging === "pending"}
                onClick={async () => {
                  setMessaging("pending");
                  setMessaging((await onMessage(person.userId)) ? "idle" : "failed");
                }}
                className="flex flex-col items-center gap-space-2xs rounded-md bg-primary-container px-space-xs py-space-sm text-center text-on-primary-action shadow-primary-rest hover:shadow-glow-primary focus-visible:shadow-focus-ring focus-visible:outline-none disabled:opacity-60 [&_svg]:size-5"
              >
                <span aria-hidden>
                  <MessageSquare />
                </span>
                <span className="type-label-md font-semibold">{t("office.profile.message")}</span>
              </button>
            ) : (
              <ActionTile icon={<MessageSquare />} label={t("office.profile.message")} hint={t("office.profile.previewHint")} />
            )}
            <ActionTile icon={<Phone />} label={t("office.profile.voiceCall")} hint={t("office.profile.phaseHint", { phase: 4 })} />
            <ActionTile icon={<Video />} label={t("office.profile.videoCall")} hint={t("office.profile.phaseHint", { phase: 4 })} />
            <ActionTile icon={<MonitorUp />} label={t("office.profile.screenShare")} hint={t("office.profile.screenShareHint")} />
            <ActionTile icon={<Mic />} label={t("office.profile.voiceNote")} hint={t("office.profile.phaseHint", { phase: 5 })} />
            <ActionTile icon={<CalendarPlus />} label={t("office.profile.inviteMeeting")} hint={t("office.profile.phaseHint", { phase: 4 })} />
          </div>
          {messaging === "failed" ? (
            <p role="alert" className="mt-space-xs type-body-sm text-error">
              {t("office.profile.messageFailed")}
            </p>
          ) : null}
        </section>
      )}

      {canFocusDesk ? (
        <Button variant="primary" size="lg" onClick={onFocusDesk}>
          <LocateFixed aria-hidden />
          {t("office.profile.focusDesk")}
        </Button>
      ) : null}
    </Panel>
  );
}

function ActionTile({ icon, label, hint }: { icon: ReactNode; label: string; hint: string }) {
  return (
    <button
      type="button"
      aria-disabled
      title={hint}
      className="flex cursor-not-allowed flex-col items-center gap-space-2xs rounded-md bg-surface-container-low px-space-xs py-space-sm text-center text-on-surface-variant [&_svg]:size-5"
    >
      <span aria-hidden className="text-on-surface-variant">{icon}</span>
      <span className="type-label-md text-on-surface">{label}</span>
      <span className="type-label-xs text-on-surface-variant">{hint}</span>
    </button>
  );
}
