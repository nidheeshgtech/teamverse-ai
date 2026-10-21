import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// DESIGN GAP: Stitch has no loading/empty/error/unconfigured states. These extend the
// level-2 glass card pattern and the HUD eyebrow typography; flagged for product-owner review.

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("rounded bg-surface-container-high motion-safe:animate-pulse", className)} {...props} />;
}

type StateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "neutral" | "error" | "warning";
  /** Heading level for the title when the message is the page's main content. */
  titleAs?: "h1" | "h2" | "p";
  className?: string;
};

export function StateMessage({ icon, title, description, action, tone = "neutral", titleAs: Title = "p", className }: StateProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("mx-auto flex max-w-md flex-col items-center gap-space-sm px-space-lg py-space-xl text-center", className)}
    >
      {icon ? (
        <span
          aria-hidden
          className={cn(
            "mb-space-xs inline-flex size-12 items-center justify-center rounded-lg bg-surface-container-high [&_svg]:size-6",
            tone === "error" && "text-destructive-text",
            tone === "warning" && "text-tertiary",
            tone === "neutral" && "text-secondary",
          )}
        >
          {icon}
        </span>
      ) : null}
      <Title className="type-title-md text-on-surface">{title}</Title>
      {description ? <p className="type-body-md text-on-surface-variant">{description}</p> : null}
      {action ? <div className="mt-space-sm">{action}</div> : null}
    </div>
  );
}
