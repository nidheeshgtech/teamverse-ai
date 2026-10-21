"use client";

import { useTranslations } from "next-intl";
import { Suspense, type ReactNode } from "react";
import { getLiveTransport } from "@/features/messaging/inbox-store";
import type { ChatPerson } from "@/features/messaging/model";
import type { ChatTransport } from "@/features/messaging/transport";
import { useOrgPresence } from "@/features/presence/use-org-presence";
import type { PresenceStatus } from "@/ui/presence";
import { StateMessage } from "@/ui/states";
import { CommsProvider } from "./comms-context";
import { ConversationList } from "./conversation-list";

type ShellProps = {
  orgId: string;
  orgName: string;
  viewerId: string;
  timezone: string;
  people: ChatPerson[];
  basePath: string;
  children: ReactNode;
};

/** Two-column Communications layout (list + routed thread). The thread adds the details column. */
export function CommsLayoutGrid({ basePath, children }: { basePath: string; children: ReactNode }) {
  return (
    <div className="grid h-[calc(100dvh-var(--spacing-topbar))] grid-cols-[22rem_minmax(0,1fr)] overflow-hidden">
      <Suspense fallback={null}>
        <ConversationList basePath={basePath} />
      </Suspense>
      <div className="flex min-h-0 min-w-0">{children}</div>
    </div>
  );
}

export function LiveComms({ orgId, orgName, viewerId, timezone, people, basePath, children, availability }: ShellProps & { availability: PresenceStatus }) {
  const t = useTranslations("states");
  const transport = getLiveTransport(orgId, viewerId);
  const { statuses } = useOrgPresence(orgId, viewerId, availability);
  if (!transport) return <StateMessage titleAs="h1" title={t("unconfiguredTitle")} className="mt-space-2xl" />;
  return (
    <CommsProvider transport={transport} viewerId={viewerId} orgId={orgId} orgName={orgName} timezone={timezone} people={people} presence={statuses}>
      <CommsLayoutGrid basePath={basePath}>{children}</CommsLayoutGrid>
    </CommsProvider>
  );
}

export function PreviewComms({ transport, presence, children, ...props }: Omit<ShellProps, "children"> & { transport: ChatTransport; presence: ReadonlyMap<string, PresenceStatus>; children: ReactNode }) {
  return (
    <CommsProvider transport={transport} presence={presence} {...props}>
      <CommsLayoutGrid basePath={props.basePath}>{children}</CommsLayoutGrid>
    </CommsProvider>
  );
}
