"use client";

import { Suspense, type ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Props = { href: string; icon: ReactNode; badge?: ReactNode; children: ReactNode };

// The pathname is request-time data on dynamic routes (e.g. /comms/[id]), so the active state
// streams in behind <Suspense>; the inactive link renders immediately in the static shell.
export function NavLink(props: Props) {
  return (
    <Suspense fallback={<NavLinkView {...props} active={false} />}>
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

function ActiveNavLink(props: Props) {
  const pathname = usePathname();
  const active = pathname === props.href || pathname.startsWith(`${props.href}/`);
  return <NavLinkView {...props} active={active} />;
}

function NavLinkView({ href, icon, badge, children, active }: Props & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/nav flex items-center gap-space-sm rounded-md px-space-md py-space-sm type-label-lg transition-[background-color,color,box-shadow] duration-200 [&_svg]:size-5",
        active
          ? "bg-primary-container font-semibold text-on-primary-action shadow-nav-active"
          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
      )}
    >
      <span aria-hidden>{icon}</span>
      {children}
      {badge}
    </Link>
  );
}
