"use client";

import { CloudOff, FlaskConical, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useComms } from "./comms-context";

// DESIGN GAP: Stitch has no offline/reconnecting state. Thin banner in the HUD warning style.
// Shows real connection state only: the first connect is silent; drops and offline are announced.
export function ConnectionBanner() {
  const t = useTranslations("comms.connection");
  const { inbox, transport } = useComms();
  const [slowFirstConnect, setSlowFirstConnect] = useState(false);
  const { connection, everLive } = inbox;

  useEffect(() => {
    if (connection !== "connecting" || everLive) return;
    const timer = setTimeout(() => setSlowFirstConnect(true), 4000);
    return () => clearTimeout(timer);
  }, [connection, everLive]);

  if (transport.mode === "demo") {
    return (
      <p className="flex items-center gap-space-xs border-b border-glass-line bg-tertiary-container/10 px-space-lg py-space-2xs type-label-md text-tertiary">
        <FlaskConical aria-hidden className="size-4" />
        {t("demo")}
      </p>
    );
  }

  const message =
    connection === "offline"
      ? t("offline")
      : connection === "error"
        ? t("error")
        : connection === "connecting" && (everLive || slowFirstConnect)
          ? everLive
            ? t("reconnecting")
            : t("connecting")
          : null;

  return (
    <p
      role="status"
      className={cn(
        "flex items-center gap-space-xs px-space-lg type-label-md text-tertiary transition-[padding] duration-200",
        message ? "border-b border-glass-line bg-tertiary-container/10 py-space-xs" : "sr-only",
      )}
    >
      {message ? connection === "offline" ? <CloudOff aria-hidden className="size-4" /> : <RefreshCw aria-hidden className="size-4 motion-safe:animate-spin" /> : null}
      {message}
    </p>
  );
}
