# TeamVerse AI

Multi-tenant virtual office communications app. Master spec: `CLAUDE_CODE_PROMPT_v3.md`. Visual source of truth: the Stitch export in `design/` (gaps and deviations in `design/GAPS.md`).

**Status: Phase 3 (Messaging) on top of Phases 1–2 (Foundation, Virtual office).** Sections for later phases render an honest "not built yet" state.

## Stack
Next.js 16 (App Router, Cache Components, `proxy.ts`) · TypeScript · Tailwind CSS 4 · Radix primitives (shadcn-style, restyled to tokens) · lucide-react · next-intl · Supabase (Auth, Postgres + RLS, Storage, Realtime) · Vitest · Playwright + axe.

## Prerequisites
- Node 22+ (tested on 26)
- Docker Desktop (for local Supabase)

## Setup
```bash
npm install
npx supabase start            # prints API URL, publishable key and secret key
cp .env.example .env.local    # fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY
npm run db:reset              # applies migrations + seed (DEMO data)
npm run dev                   # http://localhost:3000
```

Demo accounts (local only, password `demo-password-123`):
| Email | Role |
|---|---|
| admin@demo.teamverse.local | owner |
| tariq.mansour@demo.teamverse.local | admin |
| sara.alhashimi@demo.teamverse.local | admin |
| zayd.benali@demo.teamverse.local | member (others: layla.nour, noor.khalid, …) |

### Troubleshooting local Supabase
- **"mounts denied … is not shared from the host"** (Studio, `npm run db:test`): Docker Desktop can't see the repo folder. Add it under *Settings › Resources › File sharing*, or start without Studio: `npx supabase start -x studio,postgres-meta`, and run a pgTAP file with `docker exec -i supabase_db_teamverse-ai psql -U postgres -d postgres < supabase/tests/database/05_messaging.test.sql`.
- **"exec format error"** on `supabase_db_*`: a corrupted cached image. `docker rmi public.ecr.aws/supabase/postgres:<tag>` and start again.
- Full-stack e2e (`E2E_SUPABASE=1`) reuses the seeded accounts: run `npm run db:reset` first and stop `next dev` while it runs.

## Environment variables (names only)
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server only — bypasses RLS, used only to create the account when an invitation is accepted).
Without Supabase values the app runs and shows a "Supabase is not configured" state.

## Commands
| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · route typegen + tsc |
| `npm test` | Unit tests (tokens, RTL logical-property guard, auth helpers, components, messaging: markdown/XSS, thread state, receipts, files) |
| `npm run test:e2e` | Playwright + axe against a production build (`E2E_DEV=1` for `next dev`). Full-stack flows need `E2E_SUPABASE=1` with Supabase running |
| `npm run db:test` | pgTAP RLS tests (`supabase/tests/database`) |
| `npm run tokens` | Regenerate `src/styles/tokens.css` from `design/DESIGN.md` |
| `npm run db:types` | Generate Supabase TypeScript types |

## Layout
```
design/                 Stitch export (screens, code, DESIGN.md), GAPS.md
messages/en.json        All UI copy (Arabic added in Phase 8)
scripts/build-tokens.mjs  DESIGN.md → CSS variables + Tailwind theme
src/proxy.ts            i18n rewrite + Supabase session refresh + optimistic auth redirect
src/app/[locale]/       Routes: (auth) sign-in/invite, (app) shell + sections, (status), dev/* previews
src/components/office/  Office HUD, people list, profile panel, 2D plan, directory
src/components/office/scene/  React Three Fiber scene (placeholder geometry, instanced furniture)
src/features/presence/  Ephemeral Realtime presence (private channel org:<id>:presence)
src/features/messaging/ Chat transport (Supabase + in-memory demo), inbox store, thread state, safe markdown
src/components/comms/   Conversation list, thread, composer, details panel, dialogs
src/ui/                 Design-system components (tokens only)
src/components/shell/   Sidebar, top bar
src/features/*          Server actions/queries per domain
src/lib/auth/dal.ts     Data access layer: getViewer / requireMember / requireRole
supabase/               Migrations, RLS, storage policies, seed, pgTAP tests
```

## Security model (Phase 1)
- Tenant isolation and authorization are enforced in Postgres RLS; the app uses the signed-in user's client everywhere except invitation acceptance (service role, narrowly scoped).
- Admins manage membership but **cannot read private conversations** (no RLS bypass for admins).
- Invite tokens are 256-bit random values; only their SHA-256 hash is stored; links expire after 7 days and are single-use.
- Sign-up is disabled (invite-only). Post-sign-in redirects accept same-origin paths only.
- Availability is chosen by the user, never inferred from activity.

## Security model (Phase 3: messaging)
- Chat content is readable only by conversation members (RLS); admins and owners get no bypass. Public channels expose only name/topic/member count until you join.
- Messages go through `send_message()` (security invoker, so RLS applies): text + attachments are atomic and retries with the same `client_id` never duplicate.
- Realtime uses **private Broadcast** channels fed by database triggers. Members can read `conversation:<id>`, but can only *send* on `conversation:<id>:typing`, so clients cannot forge messages. `user:<id>:inbox` carries content-free pings to that user only.
- Read receipts are a watermark that never moves backwards or into the future. Others see it only if the reader shares receipts (Settings › Privacy); private read position and mute state are column-hidden.
- Messages render a safe markdown subset as React elements: no HTML injection, links limited to http(s)/mailto with `noopener noreferrer`.
- Files: private bucket, 25 MB, MIME allow-list (no HTML/SVG), path `{org}/{conversation}/{random}/{name}` checked by storage policies, size/type taken from the stored object, downloads via 5-minute signed URLs. Deleting a message wipes its text and files.
- Known limitations are listed in `design/GAPS.md` › Phase 3.

## Dev previews (no database needed)
Available in `next dev`, or in a production build only with `ENABLE_DEV_PREVIEW=1` (CI). They use a DEMO fixture generated from `supabase/seed.sql` and SIMULATED presence, both badged in the UI.
- `/dev/ui` — tokens and components
- `/dev/shell` — app shell
- `/dev/office` — virtual office (3D + 2D)
- `/dev/directory` — team directory
- `/dev/comms` — Communications with an in-memory DEMO transport (sending, editing, offline retry work locally; nothing leaves the browser)

## Phase 3 demo checklist
1. Sign in as `zayd.benali@…` → `/comms`: channels and DMs with unread pills; the sidebar shows the total.
2. Second browser as `tariq.mansour@…` → open the DM with Zayd. Type in one window → "Zayd Benali is typing…" in the other; send → it appears instantly; the sender's receipt turns to **Seen** once read.
3. DM Zayd ↔ Layla: Layla has read receipts off, so Zayd never sees "Seen". Turn yours off in **Settings › Privacy**.
4. Formatting toolbar: **bold**, *italic*, code block, list, quote. Paste `<img src=x onerror=alert(1)>` → shown as text.
5. Attach an image and a PDF (drag-and-drop or paste works too) → image preview and download via signed link; a `.html` file is rejected before upload.
6. Hover your message → Edit / Delete (delete asks for confirmation and removes files).
7. DevTools → Network → Offline: banner appears; a message you send shows "Not sent" and goes out automatically when you're back; messages others sent meanwhile appear after reconnecting.
8. **+** next to Channels → browse public channels (private ones never listed) → Join; or create a public/private channel. New message → pick one person (DM) or several (group).
9. As `tariq.mansour@…` (admin) open `/comms/c0000000-0000-4000-8000-000000000002` (Zayd ↔ Layla) → "Conversation not found".
10. `/office` or `/directory` → open a profile → **Message** opens the DM.

## Phase 2 demo checklist
1. Sign in as `admin@demo.teamverse.local` → `/office`: 3D floor with 5 rooms, labels, "Demo data" and "Placeholder 3D" badges.
2. Live presence: open a second browser as `zayd.benali@…` → both appear Online within seconds; set Busy in the top bar → ring turns amber for the other viewer; close the tab → they go offline. Nothing is stored.
3. Drag to orbit, scroll to zoom, right-drag to pan; recenter button; performance mode toggle.
4. Click an avatar (or use the People list with the keyboard) → profile panel; "Focus their desk" moves the camera; Esc closes.
5. Filter "Development" → other rooms dim, list narrows. Switch to "2D plan" → same people as buttons in a to-scale plan (choice remembered per device).
6. `/directory` → search "design", open Sara's profile.

## Phase 1 demo checklist
1. `/sign-in` → sign in as `admin@demo.teamverse.local` → lands on `/office`; sidebar shows **Organization** and a **Demo data** badge.
2. Availability menu in the top bar → choose Busy → reload → still Busy.
3. `/admin` → members table (11), create an invite link → open it in a private window → set name/password → lands on `/comms`. Reopen link → "already been used".
4. Sign in as `zayd.benali@demo.teamverse.local` → lands on `/comms`; no Organization link; `/admin` → `/forbidden`.
5. `/dev/ui` (dev only) → tokens and components; `/dev/shell` → the shell without a session.
6. Keyboard: Tab from page load → "Skip to main content" appears; every control shows a focus ring.
