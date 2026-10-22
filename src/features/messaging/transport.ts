import type { ChannelListing, ConversationDetail, ConversationKind, ConversationSummary, MessagePayload, MessageUpdate } from "./model";

/**
 * Everything the chat UI needs from the backend. The live app uses Supabase (RLS + private
 * Realtime channels); the dev preview uses an in-memory DEMO transport. Keeping the UI behind this
 * interface also keeps the visual layer swappable from data access.
 */
export type ChannelStatus = "connecting" | "live" | "error";

export type ConversationHandlers = {
  onMessage: (message: MessagePayload) => void;
  onUpdate: (update: MessageUpdate) => void;
  onRead: (userId: string, readAt: string | null) => void;
  onMembersChanged: () => void;
  onTyping: (userId: string) => void;
  /** `resumed` is true when the channel reconnects after a drop, so callers can fetch what they missed. */
  onStatus: (status: ChannelStatus, resumed: boolean) => void;
};

export type InboxHandlers = {
  onMessage: (event: { conversationId: string; senderId: string | null; createdAt: string | null }) => void;
  onMembershipChanged: (conversationId: string, change: "added" | "removed") => void;
  /** Call state changes (Phase 4), validated by the calls feature. */
  onCall?: (payload: unknown) => void;
  onStatus: (status: ChannelStatus, resumed: boolean) => void;
};

export type SendInput = {
  conversationId: string;
  clientId: string;
  body: string;
  attachments: { storage_path: string; file_name: string; duration_ms?: number | null }[];
};

export type CreateConversationInput = {
  kind: ConversationKind;
  memberIds: string[];
  name?: string;
  topic?: string;
  visibility?: "private" | "public";
};

export type MessagesPage = { messages: MessagePayload[]; hasOlder: boolean };

export interface ChatTransport {
  readonly mode: "live" | "demo";
  listConversations(): Promise<ConversationSummary[]>;
  getConversation(id: string): Promise<ConversationDetail | null>;
  loadMessages(conversationId: string, before?: string): Promise<MessagesPage>;
  loadSince(conversationId: string, after: string): Promise<MessagePayload[]>;
  sendMessage(input: SendInput): Promise<MessagePayload>;
  editMessage(id: string, body: string): Promise<void>;
  deleteMessage(message: Pick<MessagePayload, "id" | "attachments">): Promise<void>;
  markRead(conversationId: string, at: string): Promise<void>;
  uploadAttachment(path: string, file: File): Promise<void>;
  signedUrl(path: string, downloadName?: string): Promise<string>;
  browseChannels(): Promise<ChannelListing[]>;
  joinChannel(id: string): Promise<void>;
  leaveConversation(id: string): Promise<void>;
  createConversation(input: CreateConversationInput): Promise<string>;
  subscribeConversation(id: string, handlers: ConversationHandlers): () => void;
  subscribeInbox(handlers: InboxHandlers): () => void;
  sendTyping(conversationId: string): void;
}

export class ChatError extends Error {
  constructor(
    readonly code: "forbidden" | "invalid" | "network" | "unknown",
    message: string,
  ) {
    super(message);
  }
}
