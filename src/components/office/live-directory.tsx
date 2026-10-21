"use client";

import type { OfficeData } from "@/features/office/model";
import { useOrgPresence } from "@/features/presence/use-org-presence";
import type { PresenceStatus } from "@/ui/presence";
import { DirectoryView } from "./directory-view";

export function LiveDirectory({ orgId, viewerId, availability, data }: { orgId: string; viewerId: string; availability: PresenceStatus; data: OfficeData }) {
  const { statuses, connection } = useOrgPresence(orgId, viewerId, availability);
  return <DirectoryView data={data} viewerId={viewerId} presence={statuses} connection={connection} />;
}
