"use client";

import { useTranslations } from "next-intl";
import { getInboxStore, getLiveTransport, totalUnread, useInbox } from "@/features/messaging/inbox-store";

/** Real unread count from the user's inbox (shares the Communications subscription). Hidden at zero. */
export function UnreadBadge({ orgId, viewerId, placement = "sidebar" }: { orgId: string; viewerId: string; placement?: "sidebar" | "tab" }) {
  const t = useTranslations("comms");
  const transport = getLiveTransport(orgId, viewerId);
  const inbox = useInbox(transport ? getInboxStore(transport) : null);
  const count = totalUnread(inbox?.conversations);
  if (!count) return null;
  return (
    <span
      className={
        placement === "tab"
          ? "inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary-container px-1 type-label-xs text-on-primary-action ring-2 ring-surface-panel"
          : "ms-auto inline-flex h-5 min-w-6 items-center justify-center rounded-full bg-secondary-container px-space-xs type-label-xs text-on-secondary-container group-aria-[current=page]/nav:bg-on-primary-action group-aria-[current=page]/nav:text-primary-container"
      }
    >
      <span aria-hidden>{count > 99 ? t("unreadMore") : count}</span>
      <span className="sr-only">{t("unread", { count })}</span>
    </span>
  );
}
