"use client";

import { useSyncExternalStore } from "react";
import { useFormatter, useTranslations } from "next-intl";

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(id);
}

// Minute precision keeps the snapshot stable between ticks.
const getSnapshot = () => Math.floor(Date.now() / 60_000);
const getServerSnapshot = () => null;

/** "GST 14:45 UTC+4" chip from the design; renders after hydration to avoid a server/client time mismatch. */
export function LocalClock({ timeZone }: { timeZone: string }) {
  const t = useTranslations("topbar");
  const format = useFormatter();
  const minute = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const now = minute === null ? null : new Date(minute * 60_000);

  const zone = now ? zoneParts(now, timeZone) : null;

  return (
    <span className="flex items-center gap-space-xs" aria-label={t("timeLabel", { timezone: timeZone })}>
      <span className="type-code-sm text-on-surface-variant" aria-live="off">
        {zone?.abbr} {now ? format.dateTime(now, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "--:--"}
      </span>
      {zone ? <span className="rounded-sm bg-surface-container-high px-space-2xs type-label-xs text-secondary-container">{zone.offset}</span> : null}
    </span>
  );
}

function zoneParts(date: Date, timeZone: string) {
  const part = (timeZoneName: "short" | "shortOffset") =>
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName }).formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
  // "GMT+4" → "UTC+4" to match the design.
  return { abbr: timeZone === "Asia/Dubai" ? "GST" : part("short"), offset: part("shortOffset").replace("GMT", "UTC") };
}
