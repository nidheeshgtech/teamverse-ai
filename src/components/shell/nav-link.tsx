"use client";

import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-space-sm rounded-md px-space-md py-space-sm type-label-lg transition-[background-color,color,box-shadow] duration-200 [&_svg]:size-5",
        active
          ? "bg-primary-container font-semibold text-on-primary-action shadow-nav-active"
          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
      )}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </Link>
  );
}
