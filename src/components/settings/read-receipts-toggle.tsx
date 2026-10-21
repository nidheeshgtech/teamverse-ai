"use client";

import { useTranslations } from "next-intl";
import { Switch } from "radix-ui";
import { useState, useTransition } from "react";
import { updateShareReadReceipts } from "@/features/profile/actions";

// DESIGN GAP: Stitch has no Settings screen. Level-2 card row with a switch in the primary color.
export function ReadReceiptsToggle({ initial }: { initial: boolean }) {
  const t = useTranslations("settings");
  const [checked, setChecked] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [pending, startTransition] = useTransition();

  const change = (next: boolean) => {
    setChecked(next);
    startTransition(async () => {
      const { ok } = await updateShareReadReceipts(next);
      if (!ok) setChecked(!next);
      setStatus(ok ? "saved" : "failed");
    });
  };

  return (
    <div className="flex items-start justify-between gap-space-lg">
      <div className="flex flex-col gap-space-2xs">
        <label htmlFor="share-read-receipts" className="type-title-md text-on-surface">
          {t("readReceipts")}
        </label>
        <p id="share-read-receipts-hint" className="max-w-xl type-body-md text-on-surface-variant">
          {t("readReceiptsHint")}
        </p>
        <p aria-live="polite" className={status === "failed" ? "type-body-sm text-error" : "type-body-sm text-secondary"}>
          {status === "saved" ? t("saved") : status === "failed" ? t("saveFailed") : ""}
        </p>
      </div>
      <Switch.Root
        id="share-read-receipts"
        checked={checked}
        disabled={pending}
        onCheckedChange={change}
        aria-describedby="share-read-receipts-hint"
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-surface-container-highest transition-colors duration-200 focus-visible:shadow-focus-ring focus-visible:outline-none disabled:opacity-60 data-[state=checked]:bg-primary-container"
      >
        <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-on-surface shadow-level-1 transition-transform duration-200 data-[state=checked]:translate-x-5.5 rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-5.5" />
      </Switch.Root>
    </div>
  );
}
