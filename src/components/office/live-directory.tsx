"use client";

import type { OfficeData } from "@/features/office/model";
import { useStartDirectMessage } from "@/features/messaging/use-start-direct-message";
import { useOrgPresence } from "@/features/presence/use-org-presence";
import type { PresenceStatus } from "@/ui/presence";
import { DirectoryView } from "./directory-view";

export function LiveDirectory({ orgId, viewerId, availability, data }: { orgId: string; viewerId: string; availability: PresenceStatus; data: OfficeData }) {
  const { statuses, connection } = useOrgPresence(orgId, viewerId, availability);
  const startDirectMessage = useStartDirectMessage(orgId, viewerId);
  return <DirectoryView data={data} viewerId={viewerId} presence={statuses} connection={connection} onMessage={startDirectMessage} />;
}
