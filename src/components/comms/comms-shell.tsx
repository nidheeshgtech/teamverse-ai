"use client";

import { useTranslations } from "next-intl";
import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
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

const ThreadOpenContext = createContext<((open: boolean) => void) | null>(null);

/** Rendered by the thread route: tells the layout a thread is showing (phones then hide the list). */
export function ThreadOpenMarker() {
  const setOpen = useContext(ThreadOpenContext);
  useEffect(() => {
    setOpen?.(true);
    return () => setOpen?.(false);
  }, [setOpen]);
  return null;
}

/**
 * Communications layout (list + routed thread; the thread adds the details column on wide screens).
 * Below lg it behaves like a phone messenger: the list OR the open thread fills the screen.
 */
export function CommsLayoutGrid({ basePath, children }: { basePath: string; children: ReactNode }) {
  const [threadOpen, setThreadOpen] = useState(false);
  return (
    <ThreadOpenContext.Provider value={setThreadOpen}>
      <div className="grid h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] grid-cols-1 overflow-hidden lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className={cn("flex min-h-0", threadOpen && "max-lg:hidden")}>
          <Suspense fallback={null}>
            <ConversationList basePath={basePath} />
          </Suspense>
        </div>
        <div className={cn("flex min-h-0 min-w-0", !threadOpen && "max-lg:hidden")}>{children}</div>
      </div>
    </ThreadOpenContext.Provider>
  );
}

export function LiveComms({ orgId, orgName, viewerId, timezone, people, basePath, children, availability }: ShellProps & { availability: PresenceStatus }) {
  const t = useTranslations("states");
  const transport = getLiveTransport(orgId, viewerId);
  const { statuses } = useOrgPresence(orgId, viewerId, availability);
  if (!transport) return <StateMessage titleAs="h1" title={t("unconfiguredTitle")} className="mt-space-2xl" />;
  return (
    <CommsProvider transport={transport} viewerId={viewerId} orgId={orgId} orgName={orgName} timezone={timezone} people={people} presence={statuses} basePath={basePath}>
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
