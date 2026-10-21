"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// DESIGN GAP: Stitch has no modal. Extends the level-3 glass card (modals 24px radius per DESIGN.md).
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

type ContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  closeLabel: string;
  footer?: ReactNode;
};

export function DialogContent({ title, description, closeLabel, footer, className, children, ...props }: ContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-surface-canvas/70 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          "glass-level-3 fixed top-1/2 start-1/2 z-[71] flex max-h-[85dvh] w-[min(32rem,calc(100vw-2rem))] -translate-y-1/2 -translate-x-1/2 rtl:translate-x-1/2 flex-col gap-space-md rounded-xl p-space-lg text-on-surface shadow-level-3 outline-none",
          className,
        )}
        {...(description ? {} : { "aria-describedby": undefined })}
        {...props}
      >
        <div className="flex items-start justify-between gap-space-md">
          <div className="flex flex-col gap-space-2xs">
            <DialogPrimitive.Title className="type-headline-md text-on-surface">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="type-body-md text-on-surface-variant">{description}</DialogPrimitive.Description> : null}
          </div>
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="-m-space-xs inline-flex size-8 shrink-0 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:shadow-focus-ring focus-visible:outline-none"
          >
            <X aria-hidden className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="-mx-space-xs min-h-0 overflow-y-auto px-space-xs">{children}</div>
        {footer ? <div className="flex justify-end gap-space-sm">{footer}</div> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
