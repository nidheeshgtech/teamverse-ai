"use client";

import { Direction, Tooltip } from "radix-ui";
import type { ReactNode } from "react";

export function AppProviders({ dir, children }: { dir: "ltr" | "rtl"; children: ReactNode }) {
  return (
    <Direction.Provider dir={dir}>
      <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>
    </Direction.Provider>
  );
}
