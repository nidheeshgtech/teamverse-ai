"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import { Sheet, SheetContent } from "@/ui/sheet";
import { ProfilePanel } from "./profile-panel";

/**
 * The profile panel where it fits: inline on desktop (lg+), a bottom sheet on phones/tablets.
 * DESIGN GAP: Stitch shows the panel only on desktop.
 */
export function ProfileDock({ desktopClassName, ...props }: ComponentProps<typeof ProfilePanel> & { desktopClassName?: string }) {
  const t = useTranslations("office.profile");
  const desktop = useMediaQuery("(min-width: 64rem)");
  if (desktop) {
    return (
      <div className={desktopClassName}>
        <ProfilePanel {...props} />
      </div>
    );
  }
  return (
    <Sheet open onOpenChange={(open) => !open && props.onClose()}>
      <SheetContent title={t("label", { name: props.person.displayName })} hideTitle closeLabel={t("close")}>
        <ProfilePanel {...props} variant="sheet" />
      </SheetContent>
    </Sheet>
  );
}
