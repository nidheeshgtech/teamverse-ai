# Design gaps & deviations — for product-owner review

Source: Stitch project `3834886493870331771` ("TeamVerse AI Virtual Office"), exported to `design/`.
Each item is also marked in code with `DESIGN GAP` or `DESIGN DEVIATION` comments.

## Screens present in Stitch
| Screen | File |
|---|---|
| Virtual Office — 3D floorplan & HUD | `screens/virtual-office-interactive-3d-floorplan-hud.png` (+ `virtual-office-3d-rendered.png`, our WebGL capture) |
| Communications — chat & voice notes | `screens/communications-real-time-chat-voice-notes.png` |
| Executive Boardroom — conference | `screens/executive-boardroom-live-audio-video-conference.png` |
| AI Assistant — meeting insights | `screens/ai-assistant-meeting-intelligence-action-drafts.png` |
| Three.js scene (code only) | `code/three-js.html` |

## Missing screens (built by extending existing patterns)
- Sign-in, invitation acceptance — level-3 glass card over the canvas (Phase 1, built)
- Organization/admin page — level-2 cards, HUD eyebrows, badges (Phase 1, built)
- 404 / forbidden / no-organization / error / loading / "not built yet" states (Phase 1, built)
- Built in Phase 3 (DESIGN GAP, extends existing patterns): new-message dialog, channels browse/create dialog, delete confirmation, "no conversation selected" state, offline/reconnecting banner, Settings › Privacy.
- Still missing: Voice Notes page, incoming-call modal, meeting lobby & device check, notifications panel, global search results.

## Missing states
Loading, empty, error, offline/reconnecting, unconfigured integration, permission denied, hover/focus/disabled.
Phase 1 provides `Skeleton`, `StateMessage` and focus rings (`shadow-focus-ring` + global `:focus-visible` outline). Review in `/dev/ui`.

## Breakpoints
Desktop only (1280px+). Mobile/tablet deferred by the product owner on 2026-10-21.

## RTL
No Arabic layouts in Stitch. Code is RTL-ready (logical properties enforced by a unit test; `dir` set from locale; directional icons use `icon-directional`). Arabic arrives in Phase 8.

## Token conflicts
- **Radii:** Stitch's exported HTML uses `rounded` 4px / `lg` 8px / `xl` 12px, but DESIGN.md defines sm 4 / DEFAULT 8 / md 12 / lg 16 / xl 24. DESIGN.md is treated as source of truth; components pick the token that matches the screenshot (nav items = `md` 12px, cards = `lg` 16px, modals = `xl` 24px).
- **Department colors:** DESIGN.md names hues (Development cyan, Design violet, Marketing amber, Management emerald) without hex values and omits Meeting Room. Hexes taken from the Stitch Three.js scene; Meeting Room uses secondary teal.
- **Fonts:** JetBrains Mono is referenced but never loaded in Stitch HTML (renders as serif in screenshots). Now loaded via `next/font`.
- **Icons:** Material Symbols replaced by lucide-react (approved 2026-10-21). Glyph shapes differ slightly.
- **Logo:** Stitch bitmap rebuilt as SVG (`src/ui/logo.tsx`).

## Content replaced for honesty/privacy (approved 2026-10-21)
| Design shows | Replaced with | Reason |
|---|---|---|
| "DUBAI NODE LIVE 24ms" sidebar telemetry | Demo-data marker (demo org only) | No data source |
| "Lobby: Ready" chip | Omitted until Phase 4 | No lobby yet |
| Notification unread dot | No dot until notifications exist (Phase 5) | Would be fake |
| Search box | Visible but disabled; hint points to “Jump to a conversation” | Global search not built (deferred beyond Phase 3) |
| "E2EE Active", "Encrypted E2EE", "Sovereign Signed" | "Encrypted in transit" (Phase 4) | LiveKit/Supabase defaults are not end-to-end encrypted |
| "UAE PDPL 100% compliant", "Cryptographic Ledger SHA256" | Removed; consent status shown instead (Phase 6) | Unverifiable compliance claim |
| Profile "Active Work Stream" (PR/branch), "Spatial Proximity 4.2m", "Acoustic Ambience 32 dB", "Office Telemetry" counts as metrics | User-written status message; counts only from real presence (Phase 2) | Spec: no productivity inference, presence is not surveillance |
| "AI Agent (Autonomous)" action item, "Simultaneous AR Dub" | AI drafts requiring human approval (Phase 6) | Spec: AI output is a draft |
| BLEU score, "alignment 92%", latency ms | Removed | No data source |
| Push to Jira / Sync Linear | "Not configured" state | Integrations out of scope |

## Phase 2 — Virtual office & directory
**Matches the Stitch office screen:** floating HUD over a full-bleed isometric scene; layout header card; room filter chips with counts; 3D/2D toggle + view controls; presence card (Stitch "Office Telemetry"); profile panel (Stitch "Target Focus"); keyboard-hint dock; glass rooms, department-coloured monitor glow, presence rings, plants and the holo boardroom table from the Stitch Three.js scene.

| Design shows | Built | Reason |
|---|---|---|
| 4 rooms in the Three.js scene | 5 rooms (adds Project Management), positions from `office_layouts.scene` | Spec requires 5 departments; layout is data-driven |
| Single blue avatar bodies, yellow heads | Department-coloured bodies, neutral heads, translucent when offline | Distinguish departments; avoid playful look (DESIGN.md) — placeholder until final assets |
| "Office Telemetry": Present / In Huddle / DND + "Acoustic Ambience 32 dB" | "Live presence": Online / Busy / DND from real, user-chosen presence + privacy note | No ambient telemetry; In Huddle → Busy |
| "Assigned Spatial Zones" card | Searchable People list | Spec requires a searchable list / keyboard path; zones had no data source |
| Profile: verified tick, "Active Work Stream" (PR/branch), "Shared in Workspace", "Spatial Proximity 4.2m" | Desk label, local time, department, status; no work data | Spec: do not infer productivity |
| Spatial Comms: 1:1 Voice, HD Video, Voice Memo, Direct Ping, Share Feed, Schedule | Message, Voice call, Video call, Screen share, Voice note, Invite to meeting — visibly disabled with "Arrives in Phase N" / "Only during an active call" | Spec action set; features not built yet |
| "Approach Tariq's Desk" | "Focus their desk" (camera moves to the desk) | No avatar walking |
| "Mic On / Spatial 3D" dock, "Executive Boardroom: … in 12m · Join Early" banner | Omitted | No audio/meetings until Phase 4 |
| "WASD Walk / R-Click Orbit / Space Center HQ" | "Drag Orbit / Scroll Zoom / Right-drag Pan", recenter button, arrow keys pan when the canvas is focused | Matches implemented controls |
| "Boardroom · Live" chip | Omitted | No live meetings yet |
| "2D Grid" toggle (no 2D design) | 2D floor plan drawn to scale from the layout | DESIGN GAP — extends HUD card style |
| Team Directory (nav only) | Card grid + search + department filter + profile panel | DESIGN GAP |

The scene is labelled "Placeholder 3D — final office assets pending". Demo data and simulated presence (dev preview only) are badged.

## Phase 3 — Messaging
**Matches the Stitch Communications screen:** three columns (conversation list, thread, details); org card + "Jump to" filter; collapsible CHANNELS / direct-message sections with unread pills; channel header with lock/hash, topic and Huddle button; message cards with avatar, name, department chip and time; day separator; formatting toolbar + composer card with Attach / Voice Memo / Send; right column with profile, contact grid and shared files.

| Design shows | Built | Reason |
|---|---|---|
| "Direct Telemetry (8)" | "Direct messages (n)" | Plain language; no telemetry |
| Per-person activity lines ("Active on Figma Mirror", "Focus Mode: Deploying v4", "In Boardroom Sync") | Last-message preview + presence dot | No activity tracking (spec: presence is not surveillance) |
| "VIP" channel tag, "Spatial Mesh L3 · Latency 18ms" footer | Omitted | No data source |
| AI Copilot banner ("detected 2 action items… Review Draft Items") | Omitted until Phase 6 | No AI yet; AI output must be an approved draft |
| Emoji reactions (⚡4, 🇦🇪6) | Deferred (approved 2026-10-21) | Not in spec; logged for review |
| "Read by 12" under any message | "Read by N" / "Seen" under **your** latest message; counts only people who share receipts | Read receipts are opt-out per person (Settings) |
| Huddle (3) + video button | Huddle visible, disabled "Arrives in Phase 4"; video omitted | Calls are Phase 4 |
| Pin and in-thread search icons | Omitted | Not built; avoids dead controls |
| Composer placeholder "Send an encrypted broadcast…", "Transmit" | "Message #channel", "Send" | Not end-to-end encrypted |
| RTL / العربية toggle in composer | Omitted until Phase 8 | Arabic arrives in Phase 8 |
| Voice Memo button | Visible, disabled "Arrives in Phase 5" | Voice notes are Phase 5 |
| Emoji picker button | Omitted | Reactions/emoji deferred |
| Voice-note waveform message, code-block with "TYPESCRIPT" label | Code blocks render (safe markdown, language caption); voice messages in Phase 5 | — |
| Right column: "Spatial Presence · Synchronized / seated in Dubai VIP Executive Suite", "DIFC Node" chip | Department chip, local time, chosen availability | No location tracking |
| Contact grid: Direct Call / Audio Memo / Screen Share / Invite Room | Voice call, Video call, Screen share, Voice note — disabled with phase hints | Phases 4–5 |
| Shared Assets with "Encrypted E2EE" / "Sovereign Signed", "View Vault" | Shared files from loaded messages (name, size, download via short-lived signed URL) | Unverifiable claims removed |
| "GCC Sovereign Telemetry" note | Privacy note: members only (admins included), encrypted in transit not E2EE; receipts opt-out | Honest claims only |
| Profile "Message" action (office/directory) | Now works: opens or creates the DM | Built |

Groups (unnamed multi-person DMs) and the channel browser have no design and reuse the list/dialog patterns.
Message text uses a safe markdown subset (bold, italic, code, code blocks, quotes, lists, links) rendered as React elements; raw HTML in a message is shown as text.

### Known limitations (Phase 3)
- Realtime authorization is checked when a channel is joined. Someone removed from a conversation can keep receiving its broadcasts until their connection re-authenticates (token refresh, ≤1 h) — the UI drops them immediately, but a modified client would not. Phase 7: force re-join on membership change.
- Typing events carry the sender's user id as claimed by the client (members only); they are cosmetic and never stored.
- Files uploaded for a message that then fails to send, or whose removal fails after the message is deleted, stay in storage (no longer attached to any message) until the Phase 7 cleanup job.
- New-message pings fan out to each member's inbox in the database trigger; fine at agency scale, to be load-tested in Phase 7.
- Global search is not built.

## Accessibility notes
- axe (WCAG 2.1 AA) reports no serious/critical issues on sign-in and the component gallery.
- Offline presence is a hollow ring and DND has a bar, so status isn't conveyed by colour alone.
- Online pulse and skeleton shimmer stop under `prefers-reduced-motion`.
