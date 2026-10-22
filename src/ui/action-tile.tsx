import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tileClass =
  "flex min-h-[5.75rem] flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-center transition-[background-color,border-color,box-shadow] duration-200 [&_svg]:size-5";

type DisabledTileProps = { icon: ReactNode; label: string; tag: string; reason: string };

/**
 * A contact action that isn't available yet. Shown, never faked: a one-line tag ("Phase 4") with
 * the full reason as a tooltip and for screen readers.
 */
export function DisabledActionTile({ icon, label, tag, reason }: DisabledTileProps) {
  return (
    <button type="button" aria-disabled title={reason} className={cn(tileClass, "cursor-not-allowed border-glass-line bg-surface-container-low/50 text-on-surface-variant")}>
      <span aria-hidden className="text-outline">{icon}</span>
      <span className="type-label-md text-on-surface">{label}</span>
      <span className="rounded-sm bg-surface-container-high px-1.5 py-0.5 type-label-xs leading-none text-on-surface-variant">{tag}</span>
      <span className="sr-only">{reason}</span>
    </button>
  );
}

export function PrimaryActionTile({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        tileClass,
        "border-transparent bg-primary-container text-on-primary-action shadow-primary-rest hover:shadow-glow-primary focus-visible:shadow-focus-ring focus-visible:outline-none disabled:opacity-60",
      )}
    >
      <span aria-hidden>{icon}</span>
      <span className="type-label-md font-semibold">{label}</span>
    </button>
  );
}

/** A secondary contact action. With `disabledReason` it stays visible but explains why it can't run. */
export function ActionTile({ icon, label, onClick, disabledReason }: { icon: ReactNode; label: string; onClick: () => void; disabledReason?: string | null }) {
  const disabled = Boolean(disabledReason);
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      title={disabledReason ?? undefined}
      className={cn(
        tileClass,
        "border-glass-line bg-surface-container-low text-on-surface focus-visible:shadow-focus-ring focus-visible:outline-none",
        disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary-container/40 hover:bg-surface-container-high",
      )}
    >
      <span aria-hidden className={disabled ? "text-outline" : "text-primary"}>
        {icon}
      </span>
      <span className="type-label-md">{label}</span>
      {disabledReason ? <span className="sr-only">{disabledReason}</span> : null}
    </button>
  );
}
