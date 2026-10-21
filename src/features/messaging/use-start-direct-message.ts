"use client";

import { useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { getLiveTransport } from "./inbox-store";

/** Opens (or creates) the DM with someone and navigates to it. Resolves false when that fails. */
export function useStartDirectMessage(orgId: string, viewerId: string) {
  const router = useRouter();
  return useCallback(
    async (userId: string) => {
      const transport = getLiveTransport(orgId, viewerId);
      if (!transport) return false;
      try {
        const id = await transport.createConversation({ kind: "direct", memberIds: [userId] });
        router.push(`/comms/${id}`);
        return true;
      } catch {
        return false;
      }
    },
    [orgId, router, viewerId],
  );
}
