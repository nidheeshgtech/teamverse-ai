"use client";

import { useSyncExternalStore } from "react";

/** Live `matchMedia` result. On the server (and before hydration) it is `false`. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Matches Tailwind's `xl` breakpoint, where the chat details panel sits inline. */
export const WIDE_QUERY = "(min-width: 80rem)";
