"use client";

import { Bot, Building2, IdCard, LogOut, Menu as MenuIcon, MessagesSquare, Mic, Settings, Shield, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useState, type ReactNode } from "react";
import { signOut } from "@/features/auth/actions";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/ui/sheet";

type Props = {
  /** Server-rendered unread badge for Chats (streams in). */
  chatsBadge?: ReactNode;
  /** Server-rendered Organization link, present only for admins. */
  adminLink?: ReactNode;
};

const tabs = [
  { href: "/office", icon: Building2, label: "tabOffice" },
  { href: "/comms", icon: MessagesSquare, label: "tabChats" },
  { href: "/directory", icon: IdCard, label: "tabPeople" },
] as const;

const moreLinks = [
  { href: "/conferences", icon: Users, label: "conferences" },
  { href: "/voice-notes", icon: Mic, label: "voiceNotes" },
  { href: "/ai", icon: Bot, label: "ai" },
  { href: "/settings", icon: Settings, label: "settings" },
] as const;

// DESIGN GAP: Stitch has no mobile navigation. App-style bottom tab bar (< xl), with the sidebar's
// remaining sections in a "More" sheet. Hidden while a chat is open full screen.
export function MobileNav({ chatsBadge, adminLink }: Props) {
  const t = useTranslations("nav");
  return (
    <nav
      data-mobile-chrome
      aria-label={t("label")}
      className="glass-level-2 fixed inset-x-0 bottom-0 z-50 border-t border-glass-line pb-[env(safe-area-inset-bottom)] xl:hidden"
    >
      <ul className="mx-auto grid h-mobile-nav max-w-xl grid-cols-4">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Suspense fallback={<TabLink {...tab} label={t(tab.label)} active={false} badge={tab.href === "/comms" ? chatsBadge : null} />}>
              <ActiveTab {...tab} label={t(tab.label)} badge={tab.href === "/comms" ? chatsBadge : null} />
            </Suspense>
          </li>
        ))}
        <li>
          <MoreSheet adminLink={adminLink} />
        </li>
      </ul>
    </nav>
  );
}

function ActiveTab(props: { href: string; icon: typeof Building2; label: string; badge: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === props.href || pathname.startsWith(`${props.href}/`);
  return <TabLink {...props} active={active} />;
}

const tabClass = (active: boolean) =>
  cn(
    "relative flex size-full flex-col items-center justify-center gap-space-2xs type-label-xs transition-colors duration-200",
    "focus-visible:shadow-focus-ring focus-visible:outline-none",
    active ? "text-primary" : "text-on-surface-variant hover:text-on-surface",
  );

function TabLink({ href, icon: Icon, label, active, badge }: { href: string; icon: typeof Building2; label: string; active: boolean; badge: ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(tabClass(active), "group/nav")}>
      <span aria-hidden className={cn("flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-200", active && "bg-primary-container/15")}>
        <Icon className="size-5" />
      </span>
      <span className={cn(active && "font-semibold")}>{label}</span>
      {badge ? <span className="absolute top-space-2xs start-[calc(50%+0.5rem)]">{badge}</span> : null}
    </Link>
  );
}

function MoreSheet({ adminLink }: { adminLink?: ReactNode }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={tabClass(false)}>
        <span aria-hidden className="flex h-7 w-14 items-center justify-center rounded-full">
          <MenuIcon className="size-5" />
        </span>
        <span>{t("nav.more")}</span>
      </SheetTrigger>
      <SheetContent title={t("nav.more")} closeLabel={t("nav.closeMenu")}>
        {/* Closing on click: links navigate client-side, so the sheet must not linger over the new page. */}
        <ul className="flex flex-col gap-space-2xs" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          {moreLinks.map(({ href, icon: Icon, label }) => (
            <li key={href}>
              <MoreLink href={href} icon={<Icon />}>
                {t(`nav.${label}`)}
              </MoreLink>
            </li>
          ))}
          {adminLink}
          <li className="mt-space-xs border-t border-glass-line pt-space-xs">
            <button type="button" onClick={() => void signOut()} className={moreItemClass}>
              <LogOut aria-hidden className="icon-directional size-5 text-on-surface-variant" />
              {t("topbar.signOut")}
            </button>
          </li>
        </ul>
      </SheetContent>
    </Sheet>
  );
}

export const moreItemClass =
  "flex min-h-12 w-full items-center gap-space-md rounded-md px-space-sm type-label-lg text-on-surface hover:bg-surface-container-high focus-visible:shadow-focus-ring focus-visible:outline-none [&_svg]:size-5";

export function MoreLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link href={href} className={moreItemClass}>
      <span aria-hidden className="text-on-surface-variant">{icon}</span>
      {children}
    </Link>
  );
}

export function AdminMoreLink({ label }: { label: string }) {
  return (
    <li>
      <MoreLink href="/admin" icon={<Shield />}>
        {label}
      </MoreLink>
    </li>
  );
}
