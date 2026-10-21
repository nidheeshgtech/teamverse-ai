import type { Attachment, MessagePayload, MessageUpdate } from "./model";

/**
 * Thread state shared by server data, optimistic sends and Realtime events.
 * Messages are keyed by client_id while they are local, and by id once the server confirms them;
 * a confirmed copy (from the RPC response or the broadcast, whichever is first) replaces the local one.
 */
export type DeliveryStatus = "sending" | "failed" | "sent";

export type LocalFile = { name: string; size: number; type: string };

export type ThreadMessage = MessagePayload & {
  status: DeliveryStatus;
  /** Files still being uploaded with an optimistic message (shown as placeholders). */
  pendingFiles?: LocalFile[];
  error?: string;
};

export type ThreadState = {
  messages: ThreadMessage[];
  hasOlder: boolean;
  loadingOlder: boolean;
};

export type ThreadAction =
  | { type: "reset"; messages: MessagePayload[]; hasOlder: boolean }
  | { type: "older/start" }
  | { type: "older/done"; messages: MessagePayload[]; hasOlder: boolean }
  | { type: "older/failed" }
  | { type: "received"; message: MessagePayload }
  | { type: "merge"; messages: MessagePayload[] }
  | { type: "updated"; update: MessageUpdate }
  | { type: "send/start"; message: ThreadMessage }
  | { type: "send/failed"; clientId: string; error: string }
  | { type: "send/retry"; clientId: string }
  | { type: "discard"; clientId: string };

// Server timestamps (+00:00, microseconds) and optimistic ones (Z) differ as strings, so compare parsed values.
export const ts = (value: string | null | undefined) => (value ? Date.parse(value) : Number.NEGATIVE_INFINITY);

const byTime = (a: ThreadMessage, b: ThreadMessage) => ts(a.created_at) - ts(b.created_at) || a.id.localeCompare(b.id);

const confirmed = (message: MessagePayload): ThreadMessage => ({ ...message, status: "sent" });

function upsert(messages: ThreadMessage[], incoming: MessagePayload[]): ThreadMessage[] {
  if (!incoming.length) return messages;
  const next = [...messages];
  for (const message of incoming) {
    const index = next.findIndex((m) => m.id === message.id || (message.client_id !== null && m.client_id === message.client_id));
    if (index === -1) next.push(confirmed(message));
    // Never let an older copy (e.g. a late page) overwrite a newer edit/delete.
    else if (next[index].status !== "sent" || !isStale(next[index], message)) next[index] = confirmed(message);
  }
  return next.sort(byTime);
}

function isStale(current: MessagePayload, incoming: MessagePayload) {
  if (current.deleted_at && !incoming.deleted_at) return true;
  return ts(current.edited_at) > ts(incoming.edited_at);
}

export const initialThreadState = (messages: MessagePayload[], hasOlder: boolean): ThreadState => ({
  messages: messages.map(confirmed).sort(byTime),
  hasOlder,
  loadingOlder: false,
});

export function threadReducer(state: ThreadState, action: ThreadAction): ThreadState {
  switch (action.type) {
    case "reset": {
      // Keep unsent local messages across a re-fetch (e.g. after reconnecting).
      const local = state.messages.filter((m) => m.status !== "sent");
      return { ...initialThreadState(action.messages, action.hasOlder), messages: upsert(local, action.messages) };
    }
    case "older/start":
      return { ...state, loadingOlder: true };
    case "older/done":
      return { messages: upsert(state.messages, action.messages), hasOlder: action.hasOlder, loadingOlder: false };
    case "older/failed":
      return { ...state, loadingOlder: false };
    case "received":
      return { ...state, messages: upsert(state.messages, [action.message]) };
    case "merge":
      return { ...state, messages: upsert(state.messages, action.messages) };
    case "updated":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.update.id
            ? { ...m, ...action.update, attachments: action.update.deleted_at ? ([] as Attachment[]) : m.attachments }
            : m,
        ),
      };
    case "send/start":
      return { ...state, messages: [...state.messages, action.message].sort(byTime) };
    case "send/failed":
      return {
        ...state,
        messages: state.messages.map((m) => (m.client_id === action.clientId && m.status !== "sent" ? { ...m, status: "failed", error: action.error } : m)),
      };
    case "send/retry":
      return {
        ...state,
        messages: state.messages.map((m) => (m.client_id === action.clientId && m.status === "failed" ? { ...m, status: "sending", error: undefined } : m)),
      };
    case "discard":
      return { ...state, messages: state.messages.filter((m) => !(m.client_id === action.clientId && m.status !== "sent")) };
  }
}

/** Newest confirmed message timestamp, used to fetch what was missed while disconnected. */
export function latestConfirmedAt(state: ThreadState): string | null {
  for (let i = state.messages.length - 1; i >= 0; i--) if (state.messages[i].status === "sent") return state.messages[i].created_at;
  return null;
}

/**
 * How many other members have read a message, from their shared read watermarks.
 * Members who turned off read receipts have a null watermark and are never counted.
 */
export function readByCount(message: Pick<MessagePayload, "created_at" | "sender_id">, watermarks: Map<string, string | null>): number {
  let count = 0;
  for (const [userId, readAt] of watermarks) {
    if (userId !== message.sender_id && ts(readAt) >= ts(message.created_at)) count++;
  }
  return count;
}

/** Group consecutive messages from one sender within 5 minutes, like the Stitch thread. */
export function startsGroup(previous: ThreadMessage | undefined, current: ThreadMessage): boolean {
  if (!previous || previous.sender_id !== current.sender_id) return true;
  if (previous.deleted_at || current.kind === "system") return true;
  return ts(current.created_at) - ts(previous.created_at) > 5 * 60_000;
}

export function sameDay(a: string, b: string, timeZone: string): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date(a)) === fmt.format(new Date(b));
}
