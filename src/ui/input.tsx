import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// DESIGN.md › Input Fields & Search Bars.
const fieldClasses = [
  "w-full rounded border border-surface-glass-border bg-input-fill type-body-md text-on-surface",
  "placeholder:text-on-surface-variant transition-[border-color,box-shadow] duration-200",
  "focus-visible:border-primary-container focus-visible:outline-none focus-visible:shadow-focus-ring",
  "aria-invalid:border-error disabled:cursor-not-allowed disabled:opacity-50",
];

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input data-slot="input" className={cn(fieldClasses, "h-10 px-space-md", className)} {...props} />;
}

type InputWithIconProps = ComponentProps<"input"> & { icon: ReactNode; trailing?: ReactNode };

/** Text input with a leading icon and optional trailing slot (e.g. a shortcut hint). */
export function InputWithIcon({ icon, trailing, className, ...props }: InputWithIconProps) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <span aria-hidden className="pointer-events-none absolute start-space-md text-on-surface-variant [&_svg]:size-4.5">
        {icon}
      </span>
      <input data-slot="input" className={cn(fieldClasses, "h-10 ps-10", trailing ? "pe-16" : "pe-space-md")} {...props} />
      {trailing ? <span className="absolute end-space-sm">{trailing}</span> : null}
    </div>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("type-label-md text-on-surface-variant", className)} {...props} />;
}

export function FieldError({ className, ...props }: ComponentProps<"p">) {
  return <p role="alert" className={cn("type-body-sm text-error", className)} {...props} />;
}
