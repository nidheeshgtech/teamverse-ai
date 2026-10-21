"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// DESIGN GAP: Stitch has no mobile screens. A sheet is the level-3 glass card docked to the bottom
// (phones) or the inline end edge (tablets), like a native app's slide-up panel.
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

type SheetContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  /** Visually hide the title (it stays the dialog's accessible name). */
  hideTitle?: boolean;
  closeLabel: string;
  side?: "bottom" | "end";
  children: ReactNode;
};

export function SheetContent({ title, hideTitle = false, closeLabel, side = "bottom", className, children, ...props }: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-surface-canvas/70 backdrop-blur-sm" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          "glass-level-3 fixed z-[71] flex flex-col text-on-surface shadow-level-3 outline-none",
          side === "bottom"
            ? "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl pb-[max(var(--spacing-space-md),env(safe-area-inset-bottom))]"
            : "inset-y-0 end-0 w-[min(26rem,100vw)] rounded-s-xl",
          className,
        )}
        {...props}
      >
        {side === "bottom" ? <span aria-hidden className="mx-auto mt-space-sm h-1 w-10 shrink-0 rounded-full bg-outline-variant" /> : null}
        <div className={cn("flex shrink-0 items-center justify-between gap-space-md px-space-lg pt-space-md", hideTitle && "pt-space-xs")}>
          <DialogPrimitive.Title className={cn("type-title-md text-on-surface", hideTitle && "sr-only")}>{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="-me-space-xs ms-auto inline-flex size-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:shadow-focus-ring focus-visible:outline-none"
          >
            <X aria-hidden className="size-5" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-space-lg pb-space-md">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
