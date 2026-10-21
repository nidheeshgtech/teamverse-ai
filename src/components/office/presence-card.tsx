"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { presenceSummary } from "@/features/office/model";
import type { PresenceConnection } from "@/features/presence/use-org-presence";
import { Badge } from "@/ui/badge";
import { Panel, PanelEyebrow } from "@/ui/panel";
import { PresenceDot } from "@/ui/presence";

type Connection = PresenceConnection | "simulated";

const connectionTone = { live: "primary", connecting: "neutral", error: "danger", unconfigured: "warning", simulated: "warning" } as const;

// Stitch "Office Telemetry" card. DESIGN DEVIATION: counts come only from live, user-chosen
// presence ("In Huddle" → Busy); no ambient-noise or other telemetry.
export function PresenceCard({ summary, connection }: { summary: ReturnType<typeof presenceSummary>; connection: Connection }) {
  const t = useTranslations();
  const stats = [
    { status: "online", value: summary.online },
    { status: "busy", value: summary.busy },
    { status: "dnd", value: summary.dnd },
  ] as const;

  return (
    <Panel level={2} aria-labelledby="presence-title">
      <div className="flex items-center justify-between">
        <PanelEyebrow id="presence-title">{t("office.presenceTitle")}</PanelEyebrow>
        <Badge tone={connectionTone[connection]} aria-live="polite">{t(`office.connection.${connection}`)}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {stats.map(({ status, value }) => (
          <div key={status} className="flex flex-col-reverse items-center gap-1 rounded-lg border border-glass-line bg-surface-container-low/60 px-2 py-3">
            <dt className="type-label-md text-on-surface-variant">{t(`presence.${status}`)}</dt>
            <dd className="flex items-center gap-2 type-headline-md tabular-nums text-on-surface">
              <PresenceDot status={status} />
              {String(value).padStart(2, "0")}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 flex gap-2.5 rounded-lg bg-surface-container-low/60 px-3 py-2.5 type-body-sm leading-5 text-on-surface-variant">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        {t("office.presenceNote")}
      </p>
    </Panel>
  );
}
