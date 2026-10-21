import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// DESIGN.md › Buttons & Action Triggers. Radius: 8px base components.
export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-space-sm rounded-md whitespace-nowrap type-label-lg",
    "transition-[background-color,border-color,box-shadow,color] duration-200",
    "focus-visible:outline-none focus-visible:shadow-focus-ring",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4.5 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary-container text-on-primary-action font-semibold shadow-primary-rest hover:shadow-glow-primary",
        glass: "border border-glass-line bg-glass-fill text-text-strong hover:border-surface-glass-highlight hover:bg-glass-fill-hover",
        ghost: "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
        destructive: "border border-destructive-border bg-destructive-fill text-destructive-text hover:bg-destructive-border/40",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-5 type-title-md",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "glass", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
