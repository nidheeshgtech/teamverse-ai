"use client";

import { useCallback } from "react";
import { getInboxStore, getLiveTransport, useInbox } from "@/features/messaging/inbox-store";

/** Display name of a conversation the viewer belongs to (channel/group name, or the other members). */
export function useConversationNames(orgId: string, viewerId: string, nameOf: (userId: string) => string) {
  const transport = getLiveTransport(orgId, viewerId);
  const inbox = useInbox(transport ? getInboxStore(transport) : null);
  const conversations = inbox?.conversations;
  return useCallback(
    (conversationId: string) => {
      const c = conversations?.find((x) => x.id === conversationId);
      if (!c) return "";
      if (c.kind !== "direct" && c.name) return c.name;
      return c.member_ids
        .filter((id) => id !== viewerId)
        .map(nameOf)
        .filter(Boolean)
        .join(", ");
    },
    [conversations, nameOf, viewerId],
  );
}
