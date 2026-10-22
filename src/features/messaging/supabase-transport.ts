"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SIGNED_URL_TTL_SECONDS } from "./attachments";
import {
  channelListingSchema,
  conversationSummarySchema,
  conversationTopic,
  inboxEventSchema,
  inboxTopic,
  messagePayloadSchema,
  messageUpdateSchema,
  PAGE_SIZE,
  readEventSchema,
  typingTopic,
  type ConversationDetail,
} from "./model";
import { ChatError, type ChannelStatus, type ChatTransport, type ConversationHandlers, type InboxHandlers } from "./transport";

const MESSAGE_COLUMNS =
  "id, conversation_id, sender_id, body, kind, reply_to_id, client_id, edited_at, deleted_at, created_at, attachments:message_attachments(id, storage_path, file_name, mime_type, size_bytes, duration_ms)";

const typingSchema = z.object({ user_id: z.uuid() });

function toChatError(error: { code?: string; message: string } | null): ChatError {
  if (!error) return new ChatError("unknown", "Unknown error");
  if (error.code === "42501") return new ChatError("forbidden", error.message);
  if (error.code === "22023" || error.code === "23514") return new ChatError("invalid", error.message);
  if (/fetch|network/i.test(error.message)) return new ChatError("network", error.message);
  return new ChatError("unknown", error.message);
}

/** Subscribes a private channel and reports status, flagging re-subscriptions after a drop. */
function watchStatus(channel: RealtimeChannel, onStatus: (status: ChannelStatus, resumed: boolean) => void) {
  let everLive = false;
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      onStatus("live", everLive);
      everLive = true;
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      onStatus("error", false);
    } else if (status === "CLOSED") {
      onStatus("connecting", false);
    }
  });
}

export function createSupabaseTransport(supabase: SupabaseClient, orgId: string, userId: string): ChatTransport {
  const typingChannels = new Map<string, RealtimeChannel>();

  return {
    mode: "live",

    async listConversations() {
      const { data, error } = await supabase.rpc("list_conversations", { p_org_id: orgId });
      if (error) throw toChatError(error);
      return z.array(conversationSummarySchema).parse(data ?? []);
    },

    async getConversation(id) {
      const [conversation, members] = await Promise.all([
        supabase.from("conversations").select("id, kind, visibility, name, topic").eq("id", id).maybeSingle(),
        supabase.from("conversation_members").select("user_id, role, shared_read_at").eq("conversation_id", id),
      ]);
      if (conversation.error) throw toChatError(conversation.error);
      if (members.error) throw toChatError(members.error);
      if (!conversation.data) return null;
      const detail: ConversationDetail = {
        ...(conversation.data as Omit<ConversationDetail, "members">),
        members: (members.data ?? []).map((m) => ({ userId: m.user_id, role: m.role, sharedReadAt: m.shared_read_at })),
      };
      return detail;
    },

    async loadMessages(conversationId, before) {
      let query = supabase
        .from("messages")
        .select(MESSAGE_COLUMNS)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE + 1);
      if (before) query = query.lt("created_at", before);
      const { data, error } = await query;
      if (error) throw toChatError(error);
      const rows = z.array(messagePayloadSchema).parse(data ?? []);
      return { messages: rows.slice(0, PAGE_SIZE).reverse(), hasOlder: rows.length > PAGE_SIZE };
    },

    async loadSince(conversationId, after) {
      const { data, error } = await supabase
        .from("messages")
        .select(MESSAGE_COLUMNS)
        .eq("conversation_id", conversationId)
        .gt("created_at", after)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw toChatError(error);
      return z.array(messagePayloadSchema).parse(data ?? []);
    },

    async sendMessage(input) {
      const { data, error } = await supabase.rpc("send_message", {
        p_conversation_id: input.conversationId,
        p_body: input.body,
        p_client_id: input.clientId,
        p_attachments: input.attachments,
      });
      if (error) throw toChatError(error);
      return messagePayloadSchema.parse(data);
    },

    async editMessage(id, body) {
      const { error } = await supabase.from("messages").update({ body }).eq("id", id);
      if (error) throw toChatError(error);
    },

    async deleteMessage(message) {
      // Delete the message first (wipes text, drops attachment rows), then its files. If removing
      // a file fails it is orphaned, never re-attached; Phase 7 cleanup removes such objects.
      const { error } = await supabase.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", message.id);
      if (error) throw toChatError(error);
      const paths = message.attachments.map((a) => a.storage_path);
      if (paths.length) await supabase.storage.from("attachments").remove(paths);
    },

    async markRead(conversationId, at) {
      const { error } = await supabase
        .from("conversation_members")
        .update({ last_read_at: at })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      if (error) throw toChatError(error);
    },

    async uploadAttachment(path, file) {
      const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw toChatError({ message: error.message });
    },

    async signedUrl(path, downloadName) {
      const { data, error } = await supabase.storage
        .from("attachments")
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, downloadName ? { download: downloadName } : undefined);
      if (error || !data) throw toChatError(error ? { message: error.message } : null);
      return data.signedUrl;
    },

    async browseChannels() {
      const { data, error } = await supabase.rpc("browse_channels", { p_org_id: orgId });
      if (error) throw toChatError(error);
      return z.array(channelListingSchema).parse(data ?? []);
    },

    async joinChannel(id) {
      const { error } = await supabase.rpc("join_channel", { p_conversation_id: id });
      if (error) throw toChatError(error);
    },

    async leaveConversation(id) {
      const { error } = await supabase.from("conversation_members").delete().eq("conversation_id", id).eq("user_id", userId);
      if (error) throw toChatError(error);
    },

    async createConversation(input) {
      const { data, error } = await supabase.rpc("create_conversation", {
        p_org_id: orgId,
        p_kind: input.kind,
        p_member_ids: input.memberIds,
        p_name: input.name ?? null,
        p_topic: input.topic ?? null,
        p_visibility: input.visibility ?? "private",
      });
      if (error) throw toChatError(error);
      return z.uuid().parse(data);
    },

    subscribeConversation(id, handlers: ConversationHandlers) {
      const events = supabase
        .channel(conversationTopic(id), { config: { private: true } })
        .on("broadcast", { event: "message_created" }, ({ payload }) => {
          const parsed = messagePayloadSchema.safeParse(payload);
          if (parsed.success) handlers.onMessage(parsed.data);
        })
        .on("broadcast", { event: "message_updated" }, ({ payload }) => {
          const parsed = messageUpdateSchema.safeParse(payload);
          if (parsed.success) handlers.onUpdate(parsed.data);
        })
        .on("broadcast", { event: "read" }, ({ payload }) => {
          const parsed = readEventSchema.safeParse(payload);
          if (parsed.success) handlers.onRead(parsed.data.user_id, parsed.data.read_at);
        })
        .on("broadcast", { event: "members_changed" }, () => handlers.onMembersChanged());
      watchStatus(events, handlers.onStatus);

      const typing = supabase
        .channel(typingTopic(id), { config: { private: true, broadcast: { self: false } } })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const parsed = typingSchema.safeParse(payload);
          if (parsed.success && parsed.data.user_id !== userId) handlers.onTyping(parsed.data.user_id);
        });
      typing.subscribe();
      typingChannels.set(id, typing);

      return () => {
        typingChannels.delete(id);
        void supabase.removeChannel(events);
        void supabase.removeChannel(typing);
      };
    },

    subscribeInbox(handlers: InboxHandlers) {
      const channel = supabase
        .channel(inboxTopic(userId), { config: { private: true } })
        .on("broadcast", { event: "message" }, ({ payload }) => {
          const parsed = inboxEventSchema.safeParse(payload);
          if (parsed.success)
            handlers.onMessage({
              conversationId: parsed.data.conversation_id,
              senderId: parsed.data.sender_id ?? null,
              createdAt: parsed.data.created_at ?? null,
            });
        })
        .on("broadcast", { event: "conversation_added" }, ({ payload }) => {
          const parsed = inboxEventSchema.safeParse(payload);
          if (parsed.success) handlers.onMembershipChanged(parsed.data.conversation_id, "added");
        })
        .on("broadcast", { event: "conversation_removed" }, ({ payload }) => {
          const parsed = inboxEventSchema.safeParse(payload);
          if (parsed.success) handlers.onMembershipChanged(parsed.data.conversation_id, "removed");
        })
        .on("broadcast", { event: "call" }, ({ payload }) => handlers.onCall?.(payload));
      watchStatus(channel, handlers.onStatus);
      return () => void supabase.removeChannel(channel);
    },

    sendTyping(conversationId) {
      void typingChannels.get(conversationId)?.send({ type: "broadcast", event: "typing", payload: { user_id: userId } });
    },
  };
}

