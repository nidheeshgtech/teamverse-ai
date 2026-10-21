"use client";

import type { OfficeData } from "@/features/office/model";
import { useStartDirectMessage } from "@/features/messaging/use-start-direct-message";
import { useOrgPresence } from "@/features/presence/use-org-presence";
import type { PresenceStatus } from "@/ui/presence";
import { OfficeView } from "./office-view";

type Props = { orgId: string; viewerId: string; availability: PresenceStatus; lowBandwidth: boolean; data: OfficeData };

/** Office view fed by real, ephemeral Supabase Realtime presence. */
export function LiveOffice({ orgId, viewerId, availability, lowBandwidth, data }: Props) {
  const { statuses, connection } = useOrgPresence(orgId, viewerId, availability);
  const startDirectMessage = useStartDirectMessage(orgId, viewerId);
  return <OfficeView data={data} viewerId={viewerId} presence={statuses} connection={connection} lowBandwidth={lowBandwidth} onMessage={startDirectMessage} />;
}
