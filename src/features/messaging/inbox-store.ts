"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ConversationSummary } from "./model";
import { createSupabaseTransport } from "./supabase-transport";
import { ts } from "./thread-state";
import type { ChannelStatus, ChatTransport } from "./transport";

export type InboxConnection = ChannelStatus | "offline";

export type InboxSnapshot = {
  conversations: ConversationSummary[] | null;
  error: boolean;
  connection: InboxConnection;
  /** True once the inbox channel has connected at least once (drops after that are "reconnecting"). */
  everLive: boolean;
};

/**
 * One inbox per signed-in user, shared by the sidebar badge and the Communications list so the
 * user's private inbox channel is subscribed once. The subscription is ref-counted: it opens with the
 * first consumer and closes with the last.
 */
export class InboxStore {
  private snapshot: InboxSnapshot = { conversations: null, error: false, connection: "connecting", everLive: false };
  private listeners = new Set<() => void>();
  private consumers = 0;
  private teardown: (() => void) | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private activeId: string | null = null;

  constructor(readonly transport: ChatTransport) {}

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<InboxSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  retain() {
    if (this.consumers++ === 0) this.open();
    return () => {
      if (--this.consumers === 0) this.close();
    };
  }

  private open() {
    const onOnline = () => {
      this.set({ connection: "connecting" });
      this.reload();
    };
    const onOffline = () => this.set({ connection: "offline" });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (!navigator.onLine) this.set({ connection: "offline" });

    const unsubscribe = this.transport.subscribeInbox({
      onMessage: ({ conversationId, senderId, createdAt }) => {
        this.bump(conversationId, senderId, createdAt);
        this.scheduleReload();
      },
      onMembershipChanged: () => this.scheduleReload(0),
      onStatus: (status, resumed) => {
        if (!navigator.onLine) return;
        this.set({ connection: status, everLive: this.snapshot.everLive || status === "live" });
        // Anything that happened while disconnected is recovered by re-reading the inbox.
        if (status === "live" && resumed) this.reload();
      },
    });
    this.reload();

    this.teardown = () => {
      unsubscribe();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }

  private close() {
    this.teardown?.();
    this.teardown = null;
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
  }

  async reload() {
    try {
      const conversations = await this.transport.listConversations();
      this.set({
        conversations: conversations.map((c) => (c.id === this.activeId ? { ...c, unread_count: 0 } : c)),
        error: false,
      });
    } catch {
      this.set({ error: true });
    }
  }

  private scheduleReload(ms = 400) {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => void this.reload(), ms);
  }

  /** Immediate feedback before the (debounced) reload returns the authoritative counts. */
  private bump(conversationId: string, senderId: string | null, createdAt: string | null) {
    const list = this.snapshot.conversations;
    if (!list) return;
    const fromOther = senderId !== null && conversationId !== this.activeId;
    const next = list.map((c) =>
      c.id === conversationId
        ? { ...c, last_message_at: createdAt ?? c.last_message_at, unread_count: fromOther ? c.unread_count + 1 : c.unread_count }
        : c,
    );
    this.set({ conversations: next.sort((a, b) => ts(b.last_message_at) - ts(a.last_message_at)) });
  }

  /** The open thread is read as it arrives, so it never shows an unread badge. */
  setActive(conversationId: string | null) {
    this.activeId = conversationId;
    if (conversationId) this.markReadLocally(conversationId);
  }

  markReadLocally(conversationId: string) {
    const list = this.snapshot.conversations;
    if (!list?.some((c) => c.id === conversationId && c.unread_count > 0)) return;
    this.set({ conversations: list.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)) });
  }

  /** Keep the list preview in step with what the user just sent or saw. */
  noteMessage(conversationId: string, message: NonNullable<ConversationSummary["last_message"]>) {
    const list = this.snapshot.conversations;
    if (!list) return;
    const next = list.map((c) =>
      c.id === conversationId && ts(message.created_at) >= ts(c.last_message?.created_at)
        ? { ...c, last_message: message, last_message_at: message.created_at }
        : c,
    );
    this.set({ conversations: next.sort((a, b) => ts(b.last_message_at) - ts(a.last_message_at)) });
  }
}

const stores = new WeakMap<ChatTransport, InboxStore>();
let live: { key: string; transport: ChatTransport } | null = null;

export function getInboxStore(transport: ChatTransport): InboxStore {
  let store = stores.get(transport);
  if (!store) {
    store = new InboxStore(transport);
    stores.set(transport, store);
  }
  return store;
}

/** The Supabase transport for the signed-in user (one per browser tab), or null when unconfigured. */
export function getLiveTransport(orgId: string, userId: string): ChatTransport | null {
  const key = `${orgId}:${userId}`;
  if (live?.key === key) return live.transport;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  live = { key, transport: createSupabaseTransport(supabase, orgId, userId) };
  return live.transport;
}

export function useInbox(store: InboxStore | null): InboxSnapshot | null {
  useEffect(() => store?.retain(), [store]);
  const snapshot = useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? nullSnapshot,
    nullSnapshot,
  );
  return snapshot;
}

const noopSubscribe = () => () => {};
const nullSnapshot = () => null;

export function totalUnread(conversations: ConversationSummary[] | null | undefined): number {
  if (!conversations) return 0;
  const now = Date.now();
  return conversations.reduce((sum, c) => (c.muted_until && ts(c.muted_until) > now ? sum : sum + c.unread_count), 0);
}
