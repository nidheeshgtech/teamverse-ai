"use client";

import { Bell, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "@/features/auth/actions";
import { Avatar } from "@/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, PopoverContent, PopoverRoot, PopoverTrigger } from "@/ui/menu";
import type { PresenceStatus } from "@/ui/presence";

export function NotificationsButton() {
  const t = useTranslations("topbar");
  // DESIGN DEVIATION: Stitch shows an unread dot; there is no notification source until Phase 5,
  // so no dot is shown.
  return (
    <PopoverRoot>
      <PopoverTrigger
        aria-label={t("notifications")}
        className="inline-flex size-10 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
      >
        <Bell aria-hidden className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="type-label-xs uppercase text-secondary">{t("notifications")}</p>
        <p className="mt-space-sm type-body-md text-on-surface-variant">{t("notificationsEmpty")}</p>
      </PopoverContent>
    </PopoverRoot>
  );
}

type AccountMenuProps = { name: string; email: string; avatarUrl: string | null; status: PresenceStatus };

export function AccountMenu({ name, email, avatarUrl, status }: AccountMenuProps) {
  const t = useTranslations();
  return (
    <Menu>
      <MenuTrigger aria-label={t("topbar.account")} className="rounded-full">
        <Avatar name={name} src={avatarUrl} status={status} statusLabel={t(`presence.${status}`)} size="sm" />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>
          <span className="block type-label-lg text-on-surface">{name}</span>
          {t("topbar.signedInAs", { email })}
        </MenuLabel>
        <MenuSeparator />
        <MenuItem onSelect={() => void signOut()}>
          <LogOut aria-hidden className="icon-directional" />
          {t("topbar.signOut")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
