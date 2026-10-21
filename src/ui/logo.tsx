import { useId } from "react";
import { cn } from "@/lib/utils";

// Vector rebuild of the Stitch logo bitmap (design/assets/logo.png): gradient hexagon with three nodes.
export function LogoMark({ className }: { className?: string }) {
  const gradient = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--tv-color-primary-container)" />
          <stop offset="100%" stopColor="var(--tv-color-dept-development)" />
        </linearGradient>
      </defs>
      <path d="M16 3.5 26.8 9.75v12.5L16 28.5 5.2 22.25V9.75Z" fill="none" stroke={`url(#${gradient})`} strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="16" cy="15.5" r="3.6" fill={`url(#${gradient})`} />
      <circle cx="16" cy="3.5" r="1.6" fill="var(--tv-color-primary-container)" />
      <circle cx="5.2" cy="22.25" r="1.6" fill="var(--tv-color-dept-design)" />
      <circle cx="26.8" cy="22.25" r="1.6" fill="var(--tv-color-dept-development)" />
    </svg>
  );
}
