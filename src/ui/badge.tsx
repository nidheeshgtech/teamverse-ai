import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-space-xs rounded-sm px-space-xs py-space-2xs type-label-xs whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-surface-container-high text-on-surface-variant",
      primary: "bg-primary-container/15 text-primary",
      secondary: "bg-secondary-container/20 text-secondary",
      warning: "bg-tertiary-container/20 text-tertiary",
      danger: "bg-destructive-fill text-destructive-text",
      "dept-development": "bg-dept-development/15 text-dept-development",
      "dept-design": "bg-dept-design/15 text-dept-design",
      "dept-marketing": "bg-dept-marketing/15 text-dept-marketing",
      "dept-project-management": "bg-dept-project-management/15 text-dept-project-management",
      "dept-meeting-room": "bg-dept-meeting-room/15 text-dept-meeting-room",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return <kbd className={cn("rounded-sm bg-surface-container-high px-space-xs py-space-2xs type-code-sm text-outline", className)} {...props} />;
}
