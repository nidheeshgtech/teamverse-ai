# TeamVerse AI — Claude Code Master Implementation Prompt

You are the lead full-stack engineer and 3D experience designer. Build a production-oriented, responsive multi-tenant virtual office communications application called TeamVerse AI. The initial customer is a Dubai digital agency. Do not build a static mockup and do not claim unimplemented features work. Deliver vertical slices with working code, migrations, tests, environment examples, and setup instructions.

## Experience
- Boss/admin dashboard: premium interactive isometric 3D office with rooms for Development, Design, Marketing, Project Management, and Meeting Room. Employees represented by selectable avatars with display names and presence. Orbit/zoom/pan controls, search, department filters, performance-friendly effects, accessible keyboard navigation, and a 2D list fallback. Do not infer productivity from presence.
- Employee experience: lightweight desktop/mobile PWA with inbox, conversations, incoming calls, voice notes, meeting lobby, notifications, availability control, profile and privacy settings. Make 3D optional on mobile.
- Clicking an employee opens a profile panel with Message, Voice Call, Video Call, Screen Share, Voice Note, and Invite to Meeting. Screen sharing must occur in an active call/meeting and only after explicit user gesture.
- Support online, busy, away, offline, and do-not-disturb states; presence is ephemeral and not a surveillance metric.

## Recommended architecture
- TypeScript, Next.js App Router, React, Tailwind CSS, shadcn/ui, React Three Fiber + Drei (Three.js), GSAP for restrained motion.
- i18n: next-intl (or equivalent) from day one, English only at launch, with all UI strings in message files. Arabic and RTL are added in Phase 8.
- Supabase Auth, Postgres, Row Level Security, Storage and Realtime for messaging/presence; use server-only privileged credentials. Verify membership and authorization on every server mutation and realtime subscription.
- LiveKit for audio/video/group conferencing, adaptive streaming, and screen sharing; create short-lived room access tokens server-side after verifying membership. Use LiveKit webhooks for call state where needed. Never expose provider API secrets to browsers.
- Web Push with VAPID and service worker for supported browsers; in-app notification fallback; optionally add Firebase Cloud Messaging if requirements justify it. Push payloads should not expose sensitive message contents by default.
- MediaRecorder for voice notes, object storage for files, validation, size limits and signed URLs.
- AI via a server-side provider adapter for opt-in meeting transcription, summaries, translation, and task extraction. Display AI-generated output as drafts for human approval. No silent recording or transcription.
- Host web app on Vercel and use managed Supabase/LiveKit services. Provide deployment, cost and scaling notes. Verify current browser and provider constraints before claiming mobile PWA push/calling support.

## Domain model
organizations, memberships (org_id,user_id,role), profiles, departments, office_layouts, office_seats, conversations, conversation_members, messages, message_attachments, message_receipts, calls, call_participants, meetings, meeting_invites, notifications, push_subscriptions, ai_jobs, audit_events. Include created_at/updated_at, tenant scoping, relevant indexes and migrations. Do not store credentials in code. Private chat content must not be visible to admins merely because they are admins.

## RTL-ready rules (apply from Phase 1 onward)
Arabic/RTL support is delivered in Phase 8, but every phase must stay RTL-ready so nothing needs rework later:
- Use logical CSS properties only. In Tailwind use `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`text-start`/`text-end` instead of `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`/`text-left`/`text-right`. Do not hardcode physical left/right in custom CSS.
- Never hardcode user-facing strings in components. All UI copy goes through the i18n layer and message files.
- Set `lang` and `dir` on the `<html>` element from the active locale (English/LTR for now).
- Avoid layouts that depend on text direction, and avoid icons that imply direction without a plan to mirror them later.
- Store user locale preference on the profile (default `en`).

## Build phases with acceptance criteria
1. Foundation: initialize app, theme, responsive shell, sign-in/invite, role-based routing, sample seeded demo organization, SQL migrations and RLS tests. No secrets in client. Set up the i18n scaffolding (English only) and follow the RTL-ready rules above.
2. Virtual office: render optimized office scene with avatar selection, camera orbit/zoom, departments, searchable list, keyboard-accessible 2D fallback, mobile performance mode. Demo data must be clearly labeled.
3. Messaging: persistent one-to-one and group chats, real-time delivery, typing indicator, unread counts, read receipts, secure file upload, optimistic UI and offline/reconnect states. Verify delivery with two independent browser sessions.
4. Calling: audio/video 1:1, incoming call UI, accept/decline, timeout, busy/DND, permissions, mute, camera switch, leave, group meeting rooms and screen sharing. Test multi-user connections and denied permissions.
5. Voice notes + notifications: record/play voice messages; in-app notifications and Web Push where supported; subscription management and quiet hours; foreground/background behavior.
6. AI: explicit consent workflow for transcription, meeting summary, action-item extraction, translation and drafting; show processing/error states and allow correction/deletion.
7. Production hardening: RLS/security tests, tenant isolation, rate limits, abuse prevention, audit logs, retention/deletion policy, accessibility, mobile responsive checks, load/performance testing, observability and deployment docs.
8. Arabic + RTL: add Arabic locale with professionally reviewed translations (flag any machine-translated strings), locale switcher persisted on the profile, automatic `dir="rtl"` switching, an Arabic-capable font stack with sensible fallbacks, mirrored directional icons, RTL-correct layouts for the profile panel, chat, call overlays, filters and lists, and correct bidirectional text handling in chat (mixed Arabic/English, numbers, links, and usernames). Confirm Arabic AI transcription, summary and translation quality is shown honestly with clear limits. The 3D scene itself does not mirror, but surrounding overlays and controls must. Test every key screen in both LTR and RTL, on desktop and mobile.

## UX details
Dark navy / charcoal base with restrained electric-blue accents, premium glass panels, polished microinteractions, professional office art direction. 3D scene should be delightful but not impede communication. Keep chat/call overlays legible. Show clear real states (connecting, ringing, accepted, declined, failed, reconnecting). Provide reduced-motion and low-bandwidth settings. Avoid fake online indicators or fabricated live events.

## Security/privacy
Enforce tenant isolation at database and API layers. Implement per-conversation membership checks, storage access policies, signed URLs, secure token minting, webhook signature verification, CSRF/session protections as appropriate, XSS-safe rendering, file restrictions, user-controlled presence, consent for recordings/transcripts, configurable retention, deletion/export processes and an auditable admin model. Consider UAE privacy obligations with legal review before production.

## How to execute
First inspect the repository. Present architecture, dependency choices, data model, implementation plan and risks. Then implement Phase 1 and Phase 2 as runnable code; after those work, proceed in small tested vertical slices. For each phase give commands, env vars (names only), changed files, tests, and a demo checklist. Do not invent credentials, paid service access, or API behavior. If an integration cannot run without keys, build an honest adapter with a visible unconfigured state rather than a fake success. Prioritize fast load and responsive interactions.
