"use client";

import { DropdownMenu, Popover, Tooltip } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Floating surfaces use elevation level 3 (DESIGN.md › Modals, HUD Overlays).
const floating = "glass-level-3 z-50 min-w-56 rounded-lg p-space-xs text-on-surface outline-none";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuRadioGroup = DropdownMenu.RadioGroup;

export function MenuContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content sideOffset={sideOffset} className={cn(floating, className)} {...props} />
    </DropdownMenu.Portal>
  );
}

const itemClasses =
  "flex cursor-default select-none items-center gap-space-sm rounded px-space-sm py-space-xs type-label-lg outline-none data-[highlighted]:bg-surface-container-high data-[disabled]:opacity-50 [&_svg]:size-4";

export function MenuItem({ className, ...props }: ComponentProps<typeof DropdownMenu.Item>) {
  return <DropdownMenu.Item className={cn(itemClasses, className)} {...props} />;
}

export function MenuRadioItem({ className, children, ...props }: ComponentProps<typeof DropdownMenu.RadioItem>) {
  return (
    <DropdownMenu.RadioItem className={cn(itemClasses, "data-[state=checked]:text-primary", className)} {...props}>
      {children}
    </DropdownMenu.RadioItem>
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn("px-space-sm py-space-xs type-body-sm text-on-surface-variant", className)} {...props} />;
}

export function MenuSeparator({ className, ...props }: ComponentProps<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={cn("my-space-xs h-px bg-surface-glass-border", className)} {...props} />;
}

export const PopoverRoot = Popover.Root;
export const PopoverTrigger = Popover.Trigger;

export function PopoverContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof Popover.Content>) {
  return (
    <Popover.Portal>
      <Popover.Content sideOffset={sideOffset} className={cn(floating, "p-space-md", className)} {...props} />
    </Popover.Portal>
  );
}

export function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content sideOffset={6} className="glass-level-3 z-50 max-w-xs rounded px-space-sm py-space-xs type-body-sm text-on-surface">
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
