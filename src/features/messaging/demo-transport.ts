"use client";

import { DEMO_VIEWER_ID, demoConversations } from "./fixture";
import { PAGE_SIZE, type ConversationDetail, type ConversationSummary, type MessagePayload } from "./model";
import { ts } from "./thread-state";
import { ChatError, type ChatTransport, type ConversationHandlers, type InboxHandlers } from "./transport";

/**
 * In-memory DEMO transport for the dev preview: sends echo back after a short delay and nothing
 * leaves the browser. Labelled "Demo data" in the UI. Not used by the live app.
 */
export function createDemoTransport(): ChatTransport {
  const { details, messages, readAt } = demoConversations();
  const conversations = new Map(details.map((d) => [d.id, d]));
  const listeners = new Map<string, Set<ConversationHandlers>>();
  const inbox = new Set<InboxHandlers>();
  const files = new Map<string, string>();
  const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
  const emit = (id: string, fn: (h: ConversationHandlers) => void) => listeners.get(id)?.forEach(fn);

  const summary = (d: ConversationDetail): ConversationSummary => {
    const own = messages.filter((m) => m.conversation_id === d.id).sort((a, b) => ts(a.created_at) - ts(b.created_at));
    const last = own.at(-1) ?? null;
    const read = readAt.get(d.id) ?? null;
    return {
      id: d.id,
      kind: d.kind,
      visibility: d.visibility,
      name: d.name,
      topic: d.topic,
      last_message_at: last?.created_at ?? null,
      last_read_at: read,
      muted_until: null,
      unread_count: own.filter((m) => m.sender_id !== DEMO_VIEWER_ID && !m.deleted_at && ts(m.created_at) > ts(read)).length,
      member_count: d.members.length,
      member_ids: d.members.map((m) => m.userId).filter((id) => id !== DEMO_VIEWER_ID).slice(0, 4),
      last_message: last
        ? { id: last.id, sender_id: last.sender_id, kind: last.kind, body: last.body.slice(0, 140), deleted: Boolean(last.deleted_at), created_at: last.created_at }
        : null,
    };
  };

  return {
    mode: "demo",

    async listConversations() {
      await delay(150);
      return [...conversations.values()].map(summary).sort((a, b) => ts(b.last_message_at) - ts(a.last_message_at));
    },

    async getConversation(id) {
      await delay(100);
      return conversations.get(id) ?? null;
    },

    async loadMessages(conversationId, before) {
      await delay(200);
      const all = messages
        .filter((m) => m.conversation_id === conversationId && (!before || ts(m.created_at) < ts(before)))
        .sort((a, b) => ts(a.created_at) - ts(b.created_at));
      return { messages: all.slice(-PAGE_SIZE), hasOlder: all.length > PAGE_SIZE };
    },

    async loadSince(conversationId, after) {
      return messages.filter((m) => m.conversation_id === conversationId && ts(m.created_at) > ts(after));
    },

    async sendMessage(input) {
      await delay(300);
      if (!conversations.has(input.conversationId)) throw new ChatError("forbidden", "not a member");
      const existing = messages.find((m) => m.client_id === input.clientId);
      if (existing) return existing;
      const message: MessagePayload = {
        id: crypto.randomUUID(),
        conversation_id: input.conversationId,
        sender_id: DEMO_VIEWER_ID,
        body: input.body.trim(),
        kind: input.attachments.length ? "file" : "text",
        reply_to_id: null,
        client_id: input.clientId,
        edited_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        attachments: input.attachments.map((a) => ({
          id: crypto.randomUUID(),
          storage_path: a.storage_path,
          file_name: a.file_name,
          mime_type: files.get(`${a.storage_path}#type`) ?? "application/octet-stream",
          size_bytes: Number(files.get(`${a.storage_path}#size`) ?? 0),
          duration_ms: a.duration_ms ?? null,
        })),
      };
      messages.push(message);
      readAt.set(input.conversationId, message.created_at);
      emit(input.conversationId, (h) => h.onMessage(message));
      return message;
    },

    async editMessage(id, body) {
      const message = messages.find((m) => m.id === id);
      if (!message) return;
      message.body = body;
      message.edited_at = new Date().toISOString();
      emit(message.conversation_id, (h) => h.onUpdate({ id, body, edited_at: message.edited_at, deleted_at: null }));
    },

    async deleteMessage({ id }) {
      const message = messages.find((m) => m.id === id);
      if (!message) return;
      message.body = "";
      message.deleted_at = new Date().toISOString();
      message.attachments = [];
      emit(message.conversation_id, (h) => h.onUpdate({ id, body: "", edited_at: message.edited_at, deleted_at: message.deleted_at }));
    },

    async markRead(conversationId, at) {
      if (ts(at) > ts(readAt.get(conversationId))) readAt.set(conversationId, at);
    },

    async uploadAttachment(path, file) {
      await delay(400);
      files.set(path, URL.createObjectURL(file));
      files.set(`${path}#type`, file.type);
      files.set(`${path}#size`, String(file.size));
    },

    async signedUrl(path) {
      const url = files.get(path);
      if (!url) throw new ChatError("forbidden", "not available in the demo");
      return url;
    },

    async browseChannels() {
      await delay(150);
      return details
        .filter((d) => d.kind === "channel" && d.visibility === "public")
        .map((d) => ({ id: d.id, name: d.name ?? "", topic: d.topic, member_count: d.members.length, is_member: true, last_message_at: summary(d).last_message_at }));
    },

    async joinChannel() {},

    async leaveConversation(id) {
      conversations.delete(id);
      inbox.forEach((h) => h.onMembershipChanged(id, "removed"));
    },

    async createConversation(input) {
      await delay(200);
      if (input.kind === "direct") {
        const other = input.memberIds[0];
        const existing = [...conversations.values()].find((d) => d.kind === "direct" && d.members.some((m) => m.userId === other));
        if (existing) return existing.id;
      }
      const id = crypto.randomUUID();
      const memberIds = [...new Set([DEMO_VIEWER_ID, ...input.memberIds])];
      conversations.set(id, {
        id,
        kind: input.kind,
        visibility: input.visibility ?? "private",
        name: input.kind === "direct" ? null : (input.name ?? null),
        topic: input.topic ?? null,
        members: memberIds.map((userId) => ({ userId, role: userId === DEMO_VIEWER_ID && input.kind !== "direct" ? "owner" : "member", sharedReadAt: null })),
      });
      inbox.forEach((h) => h.onMembershipChanged(id, "added"));
      return id;
    },

    subscribeConversation(id, handlers) {
      const set = listeners.get(id) ?? new Set();
      set.add(handlers);
      listeners.set(id, set);
      const timer = setTimeout(() => handlers.onStatus("live", false), 50);
      return () => {
        clearTimeout(timer);
        set.delete(handlers);
      };
    },

    subscribeInbox(handlers) {
      inbox.add(handlers);
      const timer = setTimeout(() => handlers.onStatus("live", false), 50);
      return () => {
        clearTimeout(timer);
        inbox.delete(handlers);
      };
    },

    sendTyping() {},
  };
}
