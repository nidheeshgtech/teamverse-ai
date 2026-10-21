import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// DESIGN.md › Elevation tiers 1–3 and Shapes (cards 16px, modals/docks 24px).
const panelVariants = cva("text-on-surface", {
  variants: {
    level: {
      1: "glass-level-1 rounded-lg",
      2: "glass-level-2 rounded-lg",
      3: "glass-level-3 rounded-xl",
    },
    // 12 / 20 / 24px: cards breathe; content never touches the border.
    padding: { none: "", sm: "p-3", md: "p-5", lg: "p-space-lg" },
  },
  defaultVariants: { level: 2, padding: "md" },
});

export type PanelProps = ComponentProps<"section"> & VariantProps<typeof panelVariants>;

export function Panel({ className, level, padding, ...props }: PanelProps) {
  return <section data-slot="panel" className={cn(panelVariants({ level, padding }), className)} {...props} />;
}

/** Small uppercase heading used on HUD cards ("OFFICE TELEMETRY", "SPATIAL COMMS"). */
export function PanelEyebrow({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("type-label-xs uppercase tracking-[0.08em] text-secondary", className)} {...props} />;
}
