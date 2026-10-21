"use client";

import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { getInboxStore, useInbox, type InboxSnapshot, type InboxStore } from "@/features/messaging/inbox-store";
import type { ChatPerson, ConversationDetail, ConversationSummary } from "@/features/messaging/model";
import type { ChatTransport } from "@/features/messaging/transport";
import type { PresenceStatus } from "@/ui/presence";

type CommsContextValue = {
  transport: ChatTransport;
  store: InboxStore;
  inbox: InboxSnapshot;
  viewerId: string;
  orgId: string;
  orgName: string;
  timezone: string;
  /** Route prefix for conversation links ("/comms", or "/dev/comms" in the preview). */
  basePath: string;
  people: Map<string, ChatPerson>;
  presence: ReadonlyMap<string, PresenceStatus>;
  personName: (userId: string | null) => string;
  conversationName: (c: Pick<ConversationSummary, "kind" | "name"> & { memberIds: string[] }) => string;
  statusOf: (userId: string) => PresenceStatus;
};

const CommsContext = createContext<CommsContextValue | null>(null);

const EMPTY_INBOX: InboxSnapshot = { conversations: null, error: false, connection: "connecting", everLive: false };

type ProviderProps = {
  transport: ChatTransport;
  viewerId: string;
  orgId: string;
  orgName: string;
  timezone: string;
  basePath: string;
  people: ChatPerson[];
  presence: ReadonlyMap<string, PresenceStatus>;
  children: ReactNode;
};

export function CommsProvider({ transport, viewerId, orgId, orgName, timezone, basePath, people, presence, children }: ProviderProps) {
  const t = useTranslations("comms");
  const store = getInboxStore(transport);
  const inbox = useInbox(store) ?? EMPTY_INBOX;
  const peopleById = useMemo(() => new Map(people.map((p) => [p.userId, p])), [people]);

  const personName = useCallback(
    (userId: string | null) => (userId ? (peopleById.get(userId)?.displayName ?? t("unknownPerson")) : t("unknownPerson")),
    [peopleById, t],
  );

  const conversationName = useCallback(
    (c: Pick<ConversationSummary, "kind" | "name"> & { memberIds: string[] }) => {
      if (c.kind !== "direct" && c.name) return c.name;
      const others = c.memberIds.filter((id) => id !== viewerId);
      if (!others.length) return t("you");
      return others.map((id) => personName(id)).join(", ");
    },
    [personName, t, viewerId],
  );

  const statusOf = useCallback((userId: string) => presence.get(userId) ?? "offline", [presence]);

  const value = useMemo<CommsContextValue>(
    () => ({ transport, store, inbox, viewerId, orgId, orgName, timezone, basePath, people: peopleById, presence, personName, conversationName, statusOf }),
    [transport, store, inbox, viewerId, orgId, orgName, timezone, basePath, peopleById, presence, personName, conversationName, statusOf],
  );

  return <CommsContext.Provider value={value}>{children}</CommsContext.Provider>;
}

export function useComms() {
  const value = useContext(CommsContext);
  if (!value) throw new Error("useComms must be used inside <CommsProvider>");
  return value;
}

export const memberIdsOf = (detail: ConversationDetail) => detail.members.map((m) => m.userId);
