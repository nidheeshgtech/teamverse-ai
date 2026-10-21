import { Avatar as AvatarPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { PresenceDot, type PresenceStatus } from "./presence";

const avatarVariants = cva("relative inline-flex shrink-0", {
  variants: {
    size: {
      xs: "size-7",
      sm: "size-8",
      md: "size-10",
      lg: "size-16",
      xl: "size-28",
    },
  },
  defaultVariants: { size: "md" },
});

type AvatarProps = VariantProps<typeof avatarVariants> & {
  name: string;
  src?: string | null;
  status?: PresenceStatus;
  statusLabel?: string;
  /** Hide from assistive tech when the name and status are already present as text nearby. */
  decorative?: boolean;
  className?: string;
};

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

const initialsType = { xs: "type-label-xs", sm: "type-label-md", md: "type-label-md", lg: "type-title-md", xl: "type-headline-md" } as const;

export function Avatar({ name, src, status, statusLabel, size, decorative = false, className }: AvatarProps) {
  const large = size === "lg" || size === "xl";
  return (
    <span aria-hidden={decorative || undefined} className={cn(avatarVariants({ size }), className)}>
      <AvatarPrimitive.Root
        className={cn(
          "inline-flex size-full items-center justify-center overflow-hidden bg-surface-container-high ring-1 ring-surface-glass-border",
          large ? "rounded-lg" : "rounded-full",
          size === "xl" && "rounded-xl ring-2 ring-primary-container/40 shadow-level-2",
        )}
      >
        {src ? <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" /> : null}
        <AvatarPrimitive.Fallback delayMs={src ? 300 : 0} className={cn(initialsType[size ?? "md"], "text-secondary")}>
          {initialsFor(name)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {status ? (
        <PresenceDot status={status} label={statusLabel} size={large ? "md" : "sm"} knockout className={cn("absolute", large ? "-end-1 -bottom-1" : "end-0 bottom-0")} />
      ) : null}
    </span>
  );
}
