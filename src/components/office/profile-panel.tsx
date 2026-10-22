"use client";

import { CalendarPlus, LocateFixed, MessageSquare, Mic, MonitorUp, Phone, Video, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Occupant } from "@/features/office/model";
import { cn } from "@/lib/utils";
import { useCallActions } from "@/components/calls/use-call-actions";
import { ActionTile, DisabledActionTile, PrimaryActionTile } from "@/ui/action-tile";
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
  const calls = useCallActions();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const localTime = format.dateTime(new Date(), { timeZone: person.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const place = person.seat ? t("office.desk", { label: person.seat.label }) : t("office.noDesk");

  const phaseTag = (phase: number) => t("office.profile.phaseTag", { phase });
  const phaseReason = (phase: number) => t("office.profile.phaseHint", { phase });

  return (
    <Root variant={variant} label={t("office.profile.label", { name: person.displayName })}>
      <div className={cn("-mb-1 flex items-center justify-between", variant === "sheet" && "hidden")}>
        <PanelEyebrow>{person.seat?.label ?? t("office.noDesk")}</PanelEyebrow>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("office.profile.close")}
          className="-me-2 inline-flex size-8 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:shadow-focus-ring focus-visible:outline-none"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <Avatar name={person.displayName} src={person.avatarUrl} size="lg" status={person.status} statusLabel={t(`presence.${person.status}`)} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate type-headline-md text-on-surface">{person.displayName}</h2>
          {person.title ? <p className="mt-0.5 truncate type-body-md text-on-surface-variant">{person.title}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {person.departmentSlug ? <Badge tone={departmentTone(person.departmentSlug)}>{deptLabel(person.departmentSlug)}</Badge> : null}
            <span className="type-code-sm text-on-surface-variant">{t("office.profile.localTime", { time: localTime })}</span>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-2.5 rounded-md border border-glass-line bg-surface-container-low/60 px-3 py-2.5 type-body-md text-on-surface">
        <PresenceDot status={person.status} />
        <span className="min-w-0 truncate">
          {person.status === "offline" ? t("office.profile.notConnected") : t(`presence.${person.status}`)}
          <span className="text-on-surface-variant"> · {place}</span>
        </span>
      </p>

      {isSelf ? (
        <p className="type-body-md text-on-surface-variant">{t("office.profile.you")}</p>
      ) : (
        <section aria-labelledby="contact-title" className="flex flex-col gap-3">
          <PanelEyebrow id="contact-title">{t("office.profile.actionsTitle")}</PanelEyebrow>
          {/* Actions arrive in later phases; shown disabled with the reason instead of pretending to work. */}
          <div className="grid grid-cols-3 gap-2">
            {onMessage ? (
              <PrimaryActionTile
                icon={<MessageSquare />}
                label={t("office.profile.message")}
                disabled={messaging === "pending"}
                onClick={async () => {
                  setMessaging("pending");
                  setMessaging((await onMessage(person.userId)) ? "idle" : "failed");
                }}
              />
            ) : (
              <DisabledActionTile icon={<MessageSquare />} label={t("office.profile.message")} tag={t("office.profile.previewTag")} reason={t("office.profile.previewHint")} />
            )}
            {calls.ready ? (
              <>
                <ActionTile icon={<Phone />} label={t("office.profile.voiceCall")} disabledReason={calls.blocked} onClick={() => calls.startCall(person.userId, "audio")} />
                <ActionTile icon={<Video />} label={t("office.profile.videoCall")} disabledReason={calls.blocked} onClick={() => calls.startCall(person.userId, "video")} />
              </>
            ) : (
              <>
                <DisabledActionTile icon={<Phone />} label={t("office.profile.voiceCall")} tag={t("office.profile.previewTag")} reason={t("office.profile.previewHint")} />
                <DisabledActionTile icon={<Video />} label={t("office.profile.videoCall")} tag={t("office.profile.previewTag")} reason={t("office.profile.previewHint")} />
              </>
            )}
            <DisabledActionTile icon={<MonitorUp />} label={t("office.profile.screenShare")} tag={t("office.profile.inCallsTag")} reason={t("office.profile.screenShareHint")} />
            <DisabledActionTile icon={<Mic />} label={t("office.profile.voiceNote")} tag={phaseTag(5)} reason={phaseReason(5)} />
            <DisabledActionTile icon={<CalendarPlus />} label={t("office.profile.inviteMeeting")} tag={phaseTag(4)} reason={phaseReason(4)} />
          </div>
          {messaging === "failed" ? (
            <p role="alert" className="type-body-sm text-error">
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
    </Root>
  );
}

/** Card on desktop; plain section inside a bottom sheet (the sheet is already the card). */
function Root({ variant, label, children }: { variant: "panel" | "sheet"; label: string; children: React.ReactNode }) {
  if (variant === "sheet") {
    return (
      <section aria-label={label} className="flex flex-col gap-5">
        {children}
      </section>
    );
  }
  return (
    <Panel level={2} padding="lg" aria-label={label} className="flex flex-col gap-5">
      {children}
    </Panel>
  );
}
