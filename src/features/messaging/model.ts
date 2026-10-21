import { z } from "zod";

export const conversationKinds = ["direct", "group", "channel"] as const;
export type ConversationKind = (typeof conversationKinds)[number];

export const attachmentSchema = z.object({
  id: z.uuid(),
  storage_path: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  size_bytes: z.number(),
  duration_ms: z.number().nullable(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

/** Shape returned by send_message() and broadcast as `message_created` (see public.message_payload). */
export const messagePayloadSchema = z.object({
  id: z.uuid(),
  conversation_id: z.uuid(),
  sender_id: z.uuid().nullable(),
  body: z.string(),
  kind: z.enum(["text", "voice", "file", "system"]),
  reply_to_id: z.uuid().nullable(),
  client_id: z.uuid().nullable(),
  edited_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  attachments: z.array(attachmentSchema).default([]),
});
export type MessagePayload = z.infer<typeof messagePayloadSchema>;

export const messageUpdateSchema = z.object({
  id: z.uuid(),
  body: z.string(),
  edited_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});
export type MessageUpdate = z.infer<typeof messageUpdateSchema>;

export const readEventSchema = z.object({ user_id: z.uuid(), read_at: z.string().nullable() });

export const inboxEventSchema = z.object({
  conversation_id: z.uuid(),
  message_id: z.uuid().optional(),
  sender_id: z.uuid().nullable().optional(),
  created_at: z.string().optional(),
});

export const conversationSummarySchema = z.object({
  id: z.uuid(),
  kind: z.enum(conversationKinds),
  visibility: z.enum(["private", "public"]),
  name: z.string().nullable(),
  topic: z.string().nullable(),
  last_message_at: z.string().nullable(),
  last_read_at: z.string().nullable(),
  muted_until: z.string().nullable(),
  unread_count: z.number(),
  member_count: z.number(),
  member_ids: z.array(z.uuid()),
  last_message: z
    .object({
      id: z.uuid(),
      sender_id: z.uuid().nullable(),
      kind: z.string(),
      body: z.string(),
      deleted: z.boolean(),
      created_at: z.string(),
    })
    .nullable(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const channelListingSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  topic: z.string().nullable(),
  member_count: z.number(),
  is_member: z.boolean(),
  last_message_at: z.string().nullable(),
});
export type ChannelListing = z.infer<typeof channelListingSchema>;

/** A person who can appear in chat (from the org roster). */
export type ChatPerson = {
  userId: string;
  displayName: string;
  title: string | null;
  avatarUrl: string | null;
  timezone: string;
  departmentSlug: string | null;
  availability: string;
};

export type ThreadMember = { userId: string; role: "owner" | "member"; sharedReadAt: string | null };

export type ConversationDetail = {
  id: string;
  kind: ConversationKind;
  visibility: "private" | "public";
  name: string | null;
  topic: string | null;
  members: ThreadMember[];
};

export const PAGE_SIZE = 50;
export const TYPING_TTL_MS = 6000;
export const TYPING_THROTTLE_MS = 2500;

export const conversationTopic = (id: string) => `conversation:${id}`;
export const typingTopic = (id: string) => `conversation:${id}:typing`;
export const inboxTopic = (userId: string) => `user:${userId}:inbox`;
