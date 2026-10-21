import { MapPin, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth/dal";
import { Kbd } from "@/ui/badge";
import { LogoMark } from "@/ui/logo";
import { Hint } from "@/ui/menu";
import { Skeleton } from "@/ui/states";
import { AccountMenu, NotificationsButton } from "./account-menu";
import { AvailabilityMenu } from "./availability-menu";
import { LocalClock } from "./local-clock";

// DESIGN DEVIATION: the "Lobby: Ready" chip is omitted until meeting lobbies exist (Phase 4).
export async function Topbar() {
  const t = await getTranslations("topbar");

  return (
    <header
      data-mobile-chrome
      className="fixed inset-x-0 top-0 z-40 flex h-[var(--chrome-top)] items-center justify-between gap-space-sm bg-surface-panel/80 ps-[max(var(--spacing-margin-mobile),env(safe-area-inset-left))] pe-[max(var(--spacing-margin-mobile),env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] shadow-topbar backdrop-blur-xl xl:ms-sidebar xl:px-space-lg"
    >
      <div className="flex min-w-0 items-center gap-space-md">
        {/* Phones/tablets: brand mark in place of the sidebar logo. */}
        <span className="flex items-center gap-space-xs xl:hidden">
          <LogoMark />
          <span className="type-title-md text-on-surface max-sm:sr-only">{t("brand")}</span>
        </span>
        <div className="hidden items-center gap-space-xs rounded bg-surface-container-low/70 px-space-sm py-space-2xs md:flex">
          <MapPin aria-hidden className="size-4 text-accent-desert-sand" />
          <span className="type-label-md text-on-surface">{t("location")}</span>
          <LocalClock timeZone="Asia/Dubai" />
        </div>

        <Hint label={t("searchUnavailable")}>
          <button
            type="button"
            aria-disabled
            aria-label={`${t("searchPlaceholder")} — ${t("searchUnavailable")}`}
            className="hidden w-72 cursor-not-allowed items-center gap-space-xs rounded-md bg-surface-container-lowest/80 px-space-md py-space-xs text-start xl:flex"
          >
            <Search aria-hidden className="size-4.5 text-on-surface-variant" />
            <span className="min-w-0 flex-1 truncate type-body-sm text-on-surface-variant">{t("searchPlaceholder")}</span>
            <Kbd>{t("searchShortcut")}</Kbd>
          </button>
        </Hint>
      </div>

      <div className="flex shrink-0 items-center gap-space-xs sm:gap-space-md">
        <Suspense fallback={<Skeleton className="h-8 w-32 sm:w-48" />}>
          <ViewerControls />
        </Suspense>
      </div>
    </header>
  );
}

async function ViewerControls() {
  const viewer = await getViewer();
  if (!viewer) return null;
  return (
    <>
      <AvailabilityMenu initial={viewer.profile.availability} />
      <NotificationsButton />
      <AccountMenu
        name={viewer.profile.displayName}
        email={viewer.user.email}
        avatarUrl={viewer.profile.avatarUrl}
        status={viewer.profile.availability}
      />
    </>
  );
}
