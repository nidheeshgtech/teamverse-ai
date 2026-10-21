import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const presenceStatuses = ["online", "busy", "away", "dnd", "offline"] as const;
export type PresenceStatus = (typeof presenceStatuses)[number];

const dotColor: Record<PresenceStatus, string> = {
  online: "bg-presence-online",
  busy: "bg-presence-busy",
  away: "bg-presence-away",
  dnd: "bg-presence-dnd",
  // Offline is hollow so it is distinguishable from "away" without relying on colour alone.
  offline: "bg-surface-panel ring-presence-away ring-inset ring-2",
};

type PresenceDotProps = Omit<ComponentProps<"span">, "children"> & {
  status: PresenceStatus;
  /** Accessible label, e.g. t("presence.online"). Omit only when the status is announced nearby. */
  label?: string;
  size?: "sm" | "md";
  /** Adds the 2px canvas knockout used when the dot sits on an avatar corner. */
  knockout?: boolean;
};

// DESIGN.md › Presence Badges: circular "instrument diode"; online gets a restrained pulse
// (disabled under prefers-reduced-motion).
export function PresenceDot({ status, label, size = "sm", knockout = false, className, ...props }: PresenceDotProps) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label}
      data-status={status}
      className={cn("relative inline-flex shrink-0 rounded-full", size === "sm" ? "size-2" : "size-2.5", className)}
      {...props}
    >
      {status === "online" ? (
        <span aria-hidden className="absolute inset-0 rounded-full bg-presence-online opacity-60 motion-safe:animate-ping" />
      ) : null}
      <span
        aria-hidden
        className={cn("relative inline-flex size-full items-center justify-center rounded-full", dotColor[status], knockout && "outline-2 outline-surface-panel")}
      >
        {status === "dnd" ? <span className="h-px w-1/2 rounded-full bg-surface-panel" /> : null}
      </span>
    </span>
  );
}
