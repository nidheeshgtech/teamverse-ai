"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { updateAvailability } from "@/features/profile/actions";
import { announceAvailability } from "@/features/presence/presence-state";
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/ui/menu";
import { PresenceDot, presenceStatuses, type PresenceStatus } from "@/ui/presence";

// Order in the menu (offline last, as "appear offline").
const order: PresenceStatus[] = ["online", "busy", "away", "dnd", "offline"];

export function AvailabilityMenu({ initial }: { initial: PresenceStatus }) {
  const t = useTranslations();
  const [status, setOptimistic] = useOptimistic(initial);
  const [, startTransition] = useTransition();

  const choose = (value: string) => {
    const next = presenceStatuses.find((s) => s === value);
    if (!next) return;
    startTransition(async () => {
      setOptimistic(next);
      announceAvailability(next); // live presence updates immediately; the profile keeps the default
      await updateAvailability(next);
    });
  };

  return (
    <Menu>
      <MenuTrigger
        aria-label={`${t("topbar.availability")}: ${t(`presence.${status}`)}`}
        className="flex h-8 items-center gap-space-xs rounded px-space-sm type-label-md text-on-surface bg-surface-container-low/80 hover:bg-surface-container-high"
      >
        <PresenceDot status={status} />
        <span>{t(`presence.${status}`)}</span>
        <ChevronDown aria-hidden className="size-4 text-on-surface-variant" />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>{t("topbar.availabilityHint")}</MenuLabel>
        <MenuSeparator />
        <MenuRadioGroup value={status} onValueChange={choose}>
          {order.map((s) => (
            <MenuRadioItem key={s} value={s}>
              <PresenceDot status={s} />
              {t(`presence.${s}`)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
