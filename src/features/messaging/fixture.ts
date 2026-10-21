import { demoOfficeFixture } from "@/features/office/fixture";
import type { ChatPerson, ConversationDetail, MessagePayload } from "./model";

// DEMO FIXTURE for the dev-only /dev/comms preview. Mirrors the conversations in supabase/seed.sql,
// seen as Tariq Mansour (a...02). Never imported by production routes.

export const DEMO_VIEWER_ID = "a0000000-0000-4000-8000-000000000002";
const ORG = "d0000000-0000-4000-8000-000000000001";

const U = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const C = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const E = (n: number) => `e0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const demoPeople: ChatPerson[] = demoOfficeFixture.people.map((p) => ({
  userId: p.userId,
  displayName: p.displayName,
  title: p.title,
  avatarUrl: p.avatarUrl,
  timezone: p.timezone,
  departmentSlug: p.departmentSlug,
  availability: p.availability,
}));

const everyoneButOwner = demoPeople.map((p) => p.userId).filter((id) => id !== U(1));

export function demoConversations(now = Date.now()): { details: ConversationDetail[]; messages: MessagePayload[]; readAt: Map<string, string | null> } {
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
  const member = (userId: string, role: "owner" | "member" = "member", sharedReadAt: string | null = null) => ({ userId, role, sharedReadAt });

  const details: ConversationDetail[] = [
    {
      id: C(1), kind: "channel", visibility: "private", name: "eng-architecture", topic: "Architecture decisions and reviews (demo)",
      members: [member(U(2), "owner", ago(120)), member(U(4), "member", ago(130)), member(U(11), "member", ago(110)), member(U(3))],
    },
    {
      id: C(3), kind: "channel", visibility: "public", name: "general-announcements", topic: "Company-wide news (demo)",
      members: everyoneButOwner.map((id) => member(id, id === U(2) ? "owner" : "member", id === U(6) ? null : ago(24 * 60))),
    },
    {
      id: C(4), kind: "channel", visibility: "public", name: "design-critique", topic: "Share work in progress for feedback (demo)",
      members: [member(U(3), "owner", ago(190)), member(U(6)), member(U(2))],
    },
    { id: C(6), kind: "direct", visibility: "private", name: null, topic: null, members: [member(U(2)), member(U(3), "member", ago(60))] },
    { id: C(7), kind: "direct", visibility: "private", name: null, topic: null, members: [member(U(4), "member", ago(30)), member(U(2))] },
  ];

  const msg = (id: number, conversation: number, sender: number, body: string, minutesAgo: number): MessagePayload => ({
    id: E(id), conversation_id: C(conversation), sender_id: U(sender), body, kind: "text", reply_to_id: null, client_id: null,
    edited_at: null, deleted_at: null, created_at: ago(minutesAgo), attachments: [],
  });

  const messages: MessagePayload[] = [
    msg(1, 1, 2, "Kicking off the architecture review for the client portal. Proposal doc is up.", 180),
    msg(2, 1, 4, "Read it. I'd keep the API on edge functions and move reporting to a queue.", 160),
    msg(3, 1, 11, "Agreed. The dashboard can stream updates over Realtime instead of polling.", 135),
    msg(4, 1, 3, "Design handoff for the new components lands Thursday.", 110),
    msg(8, 3, 2, "Welcome to TeamVerse! This is **demo data**: every person and message here is fictional.", 300),
    msg(9, 3, 10, "Reminder: client review on Thursday at 10:00. Agenda in `#client-showcase`.", 240),
    msg(10, 4, 6, "First pass at the onboarding empty states. Thoughts on the illustration weight?", 210),
    msg(11, 4, 3, "Looks good. Two notes:\n- tighten the heading spacing\n- use the secondary teal for the CTA", 190),
    msg(13, 6, 2, "Can we sync on the 3D office art direction this week?", 80),
    msg(14, 6, 3, "Yes, Wednesday afternoon works for me.", 65),
    msg(15, 7, 4, "Deploy of the staging build is done. Smoke tests are green.", 30),
  ];

  // The viewer's own read positions (drives unread counts).
  const readAt = new Map<string, string | null>([
    [C(1), ago(150)],
    [C(3), ago(24 * 60)],
    [C(4), ago(200)],
    [C(6), ago(70)],
    [C(7), null],
  ]);

  return { details, messages, readAt };
}

export const DEMO_ORG_ID = ORG;
