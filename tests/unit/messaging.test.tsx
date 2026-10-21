import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageBody } from "@/components/comms/message-body";
import { CHANNEL_NAME, slugifyChannel } from "@/features/messaging/channel-name";
import { attachmentPath, checkFiles, MAX_ATTACHMENT_BYTES, safeFileName } from "@/features/messaging/attachments";
import { InboxStore, totalUnread } from "@/features/messaging/inbox-store";
import { parseInline, parseMessage, safeHref, toPlainText } from "@/features/messaging/markdown";
import type { ConversationSummary, MessagePayload } from "@/features/messaging/model";
import { initialThreadState, readByCount, startsGroup, threadReducer, type ThreadMessage } from "@/features/messaging/thread-state";
import type { ChatTransport, InboxHandlers } from "@/features/messaging/transport";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function message(n: number, overrides: Partial<MessagePayload> = {}): MessagePayload {
  return {
    id: uuid(n),
    conversation_id: uuid(900),
    sender_id: uuid(1),
    body: `message ${n}`,
    kind: "text",
    reply_to_id: null,
    client_id: null,
    edited_at: null,
    deleted_at: null,
    created_at: new Date(Date.UTC(2026, 9, 21, 10, n)).toISOString(),
    attachments: [],
    ...overrides,
  };
}

describe("safeHref", () => {
  it.each([
    ["https://example.com/a?b=1", "https://example.com/a?b=1"],
    ["mailto:team@example.com", "mailto:team@example.com"],
    ["javascript:alert(1)", null],
    ["JaVaScRiPt:alert(1)", null],
    ["data:text/html,<b>x</b>", null],
    ["/relative", null],
    ["https://exa mple.com", null],
  ])("%s → %s", (input, expected) => expect(safeHref(input)).toBe(expected));
});

describe("parseMessage", () => {
  it("parses inline formatting", () => {
    expect(parseInline("a **b** *c* `d`")).toEqual([
      { type: "text", text: "a " },
      { type: "strong", children: [{ type: "text", text: "b" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "c" }] },
      { type: "text", text: " " },
      { type: "code", text: "d" },
    ]);
  });

  it("keeps snake_case and lone markers literal", () => {
    expect(parseInline("user_id and snake_case_name")).toEqual([{ type: "text", text: "user_id and snake_case_name" }]);
    expect(parseInline("2 * 3 = 6")).toEqual([{ type: "text", text: "2 * 3 = 6" }]);
    expect(parseInline("**unclosed")).toEqual([{ type: "text", text: "**unclosed" }]);
  });

  it("autolinks http(s) URLs without trailing punctuation", () => {
    expect(parseInline("see https://example.com/x.")).toEqual([
      { type: "text", text: "see " },
      { type: "link", href: "https://example.com/x", children: [{ type: "text", text: "https://example.com/x" }] },
      { type: "text", text: "." },
    ]);
  });

  it("only links labelled URLs with safe protocols", () => {
    expect(parseInline("[docs](https://example.com)")[0]).toMatchObject({ type: "link", href: "https://example.com/" });
    expect(parseInline("[click](javascript:alert(1))")).toEqual([{ type: "text", text: "[click](javascript:alert(1))" }]);
  });

  it("parses blocks", () => {
    const blocks = parseMessage("Intro\n\n```ts\nconst a = 1;\n```\n- one\n- two\n> quoted\n1. first");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "code", "list", "quote", "list"]);
    expect(blocks[1]).toEqual({ type: "code", lang: "ts", text: "const a = 1;" });
    expect(blocks[4]).toMatchObject({ ordered: true });
  });

  it("renders an unclosed fence as code to the end", () => {
    expect(parseMessage("```\nx\ny")).toEqual([{ type: "code", lang: null, text: "x\ny" }]);
  });

  it("produces a plain-text preview", () => {
    expect(toPlainText("**Hi** there\n- tighten `spacing`")).toBe("Hi there tighten spacing");
  });
});

describe("MessageBody", () => {
  it("never renders HTML from a message", () => {
    const { container } = render(<MessageBody body={'<img src=x onerror="alert(1)"> <script>alert(2)</script>'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
  });

  it("opens safe links in a new tab without opener access", () => {
    const { container } = render(<MessageBody body="go to https://example.com or [bad](javascript:alert(1))" />);
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://example.com/");
    expect(links[0].getAttribute("rel")).toContain("noopener");
  });
});

describe("threadReducer", () => {
  const optimistic = (clientId: string): ThreadMessage => ({ ...message(50, { id: clientId, client_id: clientId }), status: "sending" });

  it("replaces an optimistic message with the confirmed copy exactly once", () => {
    const clientId = uuid(777);
    let state = threadReducer(initialThreadState([message(1)], false), { type: "send/start", message: optimistic(clientId) });
    const confirmed = message(51, { client_id: clientId });
    state = threadReducer(state, { type: "received", message: confirmed }); // RPC response
    state = threadReducer(state, { type: "received", message: confirmed }); // broadcast echo
    expect(state.messages.map((m) => [m.id, m.status])).toEqual([
      [uuid(1), "sent"],
      [uuid(51), "sent"],
    ]);
  });

  it("merges older pages in order and de-duplicates", () => {
    let state = initialThreadState([message(5), message(6)], true);
    state = threadReducer(state, { type: "older/done", messages: [message(3), message(4), message(5)], hasOlder: false });
    expect(state.messages.map((m) => m.id)).toEqual([uuid(3), uuid(4), uuid(5), uuid(6)]);
    expect(state.hasOlder).toBe(false);
  });

  it("applies edits and deletes, and ignores stale copies", () => {
    let state = initialThreadState([message(1)], false);
    state = threadReducer(state, { type: "updated", update: { id: uuid(1), body: "", edited_at: null, deleted_at: "2026-10-21T11:00:00Z" } });
    state = threadReducer(state, { type: "merge", messages: [message(1)] });
    expect(state.messages[0].deleted_at).toBe("2026-10-21T11:00:00Z");
  });

  it("keeps unsent messages across a reset and supports retry/discard", () => {
    const clientId = uuid(778);
    let state = threadReducer(initialThreadState([], false), { type: "send/start", message: optimistic(clientId) });
    state = threadReducer(state, { type: "send/failed", clientId, error: "offline" });
    state = threadReducer(state, { type: "reset", messages: [message(1)], hasOlder: false });
    expect(state.messages.find((m) => m.client_id === clientId)?.status).toBe("failed");
    state = threadReducer(state, { type: "send/retry", clientId });
    expect(state.messages.find((m) => m.client_id === clientId)?.status).toBe("sending");
    state = threadReducer(state, { type: "discard", clientId });
    expect(state.messages).toHaveLength(1);
  });

  it("orders mixed timestamp formats correctly", () => {
    const state = initialThreadState([message(2, { created_at: "2026-10-21T10:02:00.000000+00:00" }), message(1, { created_at: "2026-10-21T10:01:00Z" })], false);
    expect(state.messages.map((m) => m.id)).toEqual([uuid(1), uuid(2)]);
  });
});

describe("readByCount", () => {
  it("counts other members whose shared read position covers the message", () => {
    const m = message(10);
    const watermarks = new Map<string, string | null>([
      [uuid(1), "2026-10-21T12:00:00Z"], // sender: never counted
      [uuid(2), "2026-10-21T12:00:00Z"],
      [uuid(3), m.created_at], // exactly at the message
      [uuid(4), "2026-10-21T09:00:00Z"], // read before it was sent
      [uuid(5), null], // opted out of read receipts
    ]);
    expect(readByCount(m, watermarks)).toBe(2);
  });
});

describe("startsGroup", () => {
  it("groups consecutive messages from one sender within five minutes", () => {
    const a = { ...message(1), status: "sent" as const };
    const b = { ...message(3), status: "sent" as const };
    const c = { ...message(9), status: "sent" as const };
    const d = { ...message(10, { sender_id: uuid(2) }), status: "sent" as const };
    expect(startsGroup(undefined, a)).toBe(true);
    expect(startsGroup(a, b)).toBe(false);
    expect(startsGroup(b, c)).toBe(true);
    expect(startsGroup(c, d)).toBe(true);
  });
});

describe("attachments", () => {
  it("rejects oversize, unsupported, empty and excess files", () => {
    const { ok, rejected } = checkFiles(
      [
        { name: "a.png", size: 10, type: "image/png" },
        { name: "big.pdf", size: MAX_ATTACHMENT_BYTES + 1, type: "application/pdf" },
        { name: "page.html", size: 10, type: "text/html" },
        { name: "logo.svg", size: 10, type: "image/svg+xml" },
        { name: "empty.txt", size: 0, type: "text/plain" },
      ],
      0,
    );
    expect(ok.map((f) => f.name)).toEqual(["a.png"]);
    expect(rejected.map((r) => r.problem)).toEqual(["tooLarge", "type", "type", "empty"]);
    expect(checkFiles([{ name: "x.png", size: 1, type: "image/png" }], 10).rejected[0].problem).toBe("tooMany");
  });

  it("builds storage paths that stay inside the conversation folder", () => {
    // One path segment, never a traversal: slashes become "_" and leading dots are dropped.
    expect(safeFileName("../../etc/passwd")).toBe("_.._etc_passwd");
    expect(safeFileName(".env")).toBe("env");
    expect(safeFileName("Report Q3 (final).pdf")).toBe("Report Q3 _final_.pdf");
    expect(safeFileName("")).toBe("file");
    expect(attachmentPath("org", "conv", "a/b.png", "rnd")).toBe("org/conv/rnd/a_b.png");
  });
});

describe("channel names", () => {
  it.each([
    ["Client Showcase!", "client-showcase-"],
    ["Déjà vu", "deja-vu"],
    ["--x", "x"],
  ])("slugify %s → %s", (input, expected) => expect(slugifyChannel(input)).toBe(expected));

  it("validates the final name", () => {
    expect(CHANNEL_NAME.test("eng-architecture")).toBe(true);
    expect(CHANNEL_NAME.test("-bad")).toBe(false);
    expect(CHANNEL_NAME.test("Bad")).toBe(false);
  });
});

describe("inbox", () => {
  const summary = (id: number, unread: number, muted: string | null = null): ConversationSummary => ({
    id: uuid(id),
    kind: "channel",
    visibility: "public",
    name: `c${id}`,
    topic: null,
    last_message_at: null,
    last_read_at: null,
    muted_until: muted,
    unread_count: unread,
    member_count: 2,
    member_ids: [],
    last_message: null,
  });

  it("totals unread counts, skipping muted conversations", () => {
    expect(totalUnread([summary(1, 2), summary(2, 3, "2999-01-01T00:00:00Z"), summary(3, 1, "2000-01-01T00:00:00Z")])).toBe(3);
    expect(totalUnread(null)).toBe(0);
  });

  it("bumps unread for new messages except in the open conversation", async () => {
    let handlers: InboxHandlers | null = null;
    const transport = {
      mode: "demo",
      listConversations: vi.fn(async () => [summary(1, 0), summary(2, 0)]),
      subscribeInbox: (h: InboxHandlers) => {
        handlers = h;
        return () => {};
      },
    } as unknown as ChatTransport;
    const store = new InboxStore(transport);
    const release = store.retain();
    await vi.waitFor(() => expect(store.getSnapshot().conversations).not.toBeNull());

    store.setActive(uuid(2));
    handlers!.onMessage({ conversationId: uuid(1), senderId: uuid(5), createdAt: "2026-10-21T10:00:00Z" });
    handlers!.onMessage({ conversationId: uuid(2), senderId: uuid(5), createdAt: "2026-10-21T10:01:00Z" });

    const byId = new Map(store.getSnapshot().conversations!.map((c) => [c.id, c.unread_count]));
    expect(byId.get(uuid(1))).toBe(1);
    expect(byId.get(uuid(2))).toBe(0);
    release();
  });
});
