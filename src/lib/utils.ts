import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge about the generated type-* utilities so they dedupe like text sizes.
const twMerge = extendTailwindMerge<"type-style">({
  extend: {
    classGroups: {
      "type-style": [{ type: [(value: string) => value.length > 0] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
