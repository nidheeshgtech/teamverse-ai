# TeamVerse AI

Multi-tenant virtual office communications app. Master spec: `CLAUDE_CODE_PROMPT_v3.md`. Visual source of truth: the Stitch export in `design/` (gaps and deviations in `design/GAPS.md`).

**Status: Phase 2 (Virtual office) on top of Phase 1 (Foundation).** Sections for later phases render an honest "not built yet" state.

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

## Environment variables (names only)
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server only — bypasses RLS, used only to create the account when an invitation is accepted).
Without Supabase values the app runs and shows a "Supabase is not configured" state.

## Commands
| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · route typegen + tsc |
| `npm test` | Unit tests (tokens, RTL logical-property guard, auth helpers, components) |
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

## Dev previews (no database needed)
Available in `next dev`, or in a production build only with `ENABLE_DEV_PREVIEW=1` (CI). They use a DEMO fixture generated from `supabase/seed.sql` and SIMULATED presence, both badged in the UI.
- `/dev/ui` — tokens and components
- `/dev/shell` — app shell
- `/dev/office` — virtual office (3D + 2D)
- `/dev/directory` — team directory

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
