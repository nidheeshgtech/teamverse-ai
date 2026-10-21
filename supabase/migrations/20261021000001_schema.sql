-- =============================================================================
-- TeamVerse AI: core schema
-- =============================================================================
-- Multi-tenant virtual-office communications. Every tenant-owned row carries
-- org_id (FK organizations, on delete cascade). Cross-table references inside a
-- tenant use composite foreign keys (org_id, <fk>) so a row can never point at
-- another tenant's data, even when written by the service role.
--
-- Global (non-tenant) tables: organizations (the tenant itself), profiles and
-- push_subscriptions (a person/device can belong to several orgs).
--
-- Live presence (online/busy/away/...) is EPHEMERAL and lives in Supabase
-- Realtime presence only. profiles.availability is the user's own chosen
-- default, never a tracked or inferred status.
--
-- RLS policies, helper functions and RPCs live in 20261021000002_rls.sql.
-- Composite FKs with "on delete set null (col)" require Postgres 15+.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.membership_role as enum ('owner', 'admin', 'member');

-- User-chosen availability default only. Live presence is not stored.
create type public.presence_status as enum ('online', 'busy', 'away', 'offline', 'dnd');

create type public.conversation_kind as enum ('direct', 'group', 'channel');
create type public.conversation_member_role as enum ('owner', 'member');
create type public.message_kind as enum ('text', 'voice', 'file', 'system');

create type public.call_kind as enum ('audio', 'video');
create type public.call_status as enum ('ringing', 'active', 'ended', 'missed', 'declined', 'failed');
create type public.call_participant_status as enum ('invited', 'ringing', 'joined', 'left', 'declined', 'missed');

create type public.meeting_status as enum ('scheduled', 'live', 'ended', 'cancelled');
create type public.meeting_invite_status as enum ('pending', 'accepted', 'declined', 'tentative');

create type public.notification_kind as enum (
  'message', 'mention', 'call_incoming', 'call_missed',
  'meeting_invite', 'meeting_starting', 'ai_job', 'system'
);

create type public.ai_job_kind as enum ('transcription', 'summary', 'action_items', 'translation', 'draft');
create type public.ai_job_status as enum (
  'pending_consent', 'queued', 'processing', 'draft', 'approved', 'rejected', 'failed', 'deleted'
);

-- -----------------------------------------------------------------------------
-- Shared updated_at trigger function
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- organizations (the tenant)
-- -----------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 200),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  timezone    text not null default 'Asia/Dubai',
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- profiles (global, 1:1 with auth.users; created by trigger on auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text not null check (char_length(display_name) between 1 and 120),
  -- Mirror of auth.users.email, kept in sync by triggers. Not user-editable
  -- (no column UPDATE grant); visible only to people who share an org.
  email           text,
  avatar_url      text,
  title           text check (char_length(title) <= 120),
  timezone        text not null default 'Asia/Dubai',
  locale          text not null default 'en' check (locale in ('en', 'ar')),
  availability    public.presence_status not null default 'online',
  reduced_motion  boolean not null default false,
  low_bandwidth   boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- departments
-- -----------------------------------------------------------------------------
create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  slug        text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Name of a design token (e.g. 'dept-development'), never a raw colour.
  color_token text not null check (color_token ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, slug),
  unique (org_id, id)
);

-- -----------------------------------------------------------------------------
-- memberships (org_id, user_id, role)
-- -----------------------------------------------------------------------------
create table public.memberships (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  role          public.membership_role not null default 'member',
  department_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, user_id),
  foreign key (org_id, department_id)
    references public.departments (org_id, id) on delete set null (department_id)
);
create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_org_department_idx on public.memberships (org_id, department_id);

-- -----------------------------------------------------------------------------
-- office_layouts / office_seats
-- -----------------------------------------------------------------------------
create table public.office_layouts (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  is_active  boolean not null default false,
  scene      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id)
);
create index office_layouts_org_id_idx on public.office_layouts (org_id);
-- At most one active layout per org.
create unique index office_layouts_one_active_per_org
  on public.office_layouts (org_id) where is_active;

create table public.office_seats (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  layout_id        uuid not null,
  department_id    uuid,
  label            text not null check (char_length(label) between 1 and 60),
  position         jsonb not null default '{}'::jsonb,
  assigned_user_id uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (layout_id, label),
  foreign key (org_id, layout_id)
    references public.office_layouts (org_id, id) on delete cascade,
  foreign key (org_id, department_id)
    references public.departments (org_id, id) on delete set null (department_id),
  -- Seat assignee must be a member of the same org; leaving the org frees the seat.
  foreign key (org_id, assigned_user_id)
    references public.memberships (org_id, user_id) on delete set null (assigned_user_id)
);
create index office_seats_org_layout_idx on public.office_seats (org_id, layout_id);
create index office_seats_org_department_idx on public.office_seats (org_id, department_id);
create index office_seats_assigned_user_idx on public.office_seats (assigned_user_id);
-- A user occupies at most one seat per layout.
create unique index office_seats_one_seat_per_user
  on public.office_seats (layout_id, assigned_user_id) where assigned_user_id is not null;

-- -----------------------------------------------------------------------------
-- org_invitations
-- NOT in the original spec domain model: added to support the invite-only
-- sign-in flow. Only the SHA-256 hex digest of the invite token is stored
-- (token_hash = encode(sha256(convert_to(raw_token, 'UTF8')), 'hex')). The raw
-- token is only ever in the invite link. Acceptance goes through the
-- security-definer function public.accept_invitation(raw_token).
-- -----------------------------------------------------------------------------
create table public.org_invitations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  email         text not null check (email = lower(email) and position('@' in email) > 1),
  role          public.membership_role not null default 'member',
  department_id uuid,
  token_hash    text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by    uuid references public.profiles (id) on delete set null,
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  accepted_by   uuid references public.profiles (id) on delete set null,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (org_id, department_id)
    references public.departments (org_id, id) on delete set null (department_id)
);
create index org_invitations_org_created_idx on public.org_invitations (org_id, created_at desc);
-- One open invitation per email per org.
create unique index org_invitations_one_open_per_email
  on public.org_invitations (org_id, email) where accepted_at is null and revoked_at is null;

-- -----------------------------------------------------------------------------
-- conversations / conversation_members
-- -----------------------------------------------------------------------------
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  kind            public.conversation_kind not null,
  name            text check (char_length(name) between 1 and 120),
  topic           text check (char_length(topic) <= 500),
  -- For kind = 'direct': '<smaller uuid>:<larger uuid>' so a pair has one DM per org.
  direct_key      text,
  created_by      uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, id),
  check ((kind = 'direct') = (direct_key is not null)),
  check (kind <> 'channel' or name is not null)
);
create index conversations_org_last_message_idx
  on public.conversations (org_id, last_message_at desc nulls last);
create unique index conversations_direct_key_unique
  on public.conversations (org_id, direct_key) where direct_key is not null;

create table public.conversation_members (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null,
  user_id         uuid not null,
  role            public.conversation_member_role not null default 'member',
  last_read_at    timestamptz,
  muted_until     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (conversation_id, user_id),
  foreign key (org_id, conversation_id)
    references public.conversations (org_id, id) on delete cascade,
  -- Removing someone from the org removes them from every conversation.
  foreign key (org_id, user_id)
    references public.memberships (org_id, user_id) on delete cascade
);
create index conversation_members_user_idx on public.conversation_members (user_id);
create index conversation_members_org_user_idx on public.conversation_members (org_id, user_id);

-- -----------------------------------------------------------------------------
-- messages / message_attachments / message_receipts
-- -----------------------------------------------------------------------------
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null,
  sender_id       uuid references public.profiles (id) on delete set null,
  body            text not null default '' check (char_length(body) <= 8000),
  kind            public.message_kind not null default 'text',
  reply_to_id     uuid,
  -- Client-generated id for optimistic UI de-duplication.
  client_id       uuid,
  edited_at       timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (conversation_id, id),
  unique (sender_id, client_id),
  foreign key (org_id, conversation_id)
    references public.conversations (org_id, id) on delete cascade,
  foreign key (conversation_id, reply_to_id)
    references public.messages (conversation_id, id) on delete set null (reply_to_id)
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index messages_org_created_idx on public.messages (org_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id);

create table public.message_attachments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null,
  message_id      uuid not null,
  uploader_id     uuid references public.profiles (id) on delete set null,
  bucket          text not null default 'attachments' check (bucket = 'attachments'),
  storage_path    text not null unique,
  file_name       text not null check (char_length(file_name) between 1 and 255),
  mime_type       text not null check (char_length(mime_type) between 3 and 255),
  size_bytes      bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  duration_ms     integer check (duration_ms >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Object path must be {org_id}/{conversation_id}/... (matches storage policies).
  check (storage_path like org_id::text || '/' || conversation_id::text || '/%'),
  foreign key (org_id, conversation_id)
    references public.conversations (org_id, id) on delete cascade,
  foreign key (conversation_id, message_id)
    references public.messages (conversation_id, id) on delete cascade
);
create index message_attachments_org_idx on public.message_attachments (org_id);
create index message_attachments_message_idx on public.message_attachments (message_id);
create index message_attachments_conversation_idx on public.message_attachments (conversation_id);

create table public.message_receipts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null,
  message_id      uuid not null,
  user_id         uuid not null,
  delivered_at    timestamptz,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (message_id, user_id),
  foreign key (org_id, conversation_id)
    references public.conversations (org_id, id) on delete cascade,
  foreign key (conversation_id, message_id)
    references public.messages (conversation_id, id) on delete cascade,
  -- Only conversation members can have receipts.
  foreign key (conversation_id, user_id)
    references public.conversation_members (conversation_id, user_id) on delete cascade
);
create index message_receipts_org_idx on public.message_receipts (org_id);
create index message_receipts_conversation_user_idx on public.message_receipts (conversation_id, user_id);

-- -----------------------------------------------------------------------------
-- meetings / meeting_invites (before calls, which may reference a meeting)
-- -----------------------------------------------------------------------------
create table public.meetings (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  host_id         uuid references public.profiles (id) on delete set null,
  conversation_id uuid,
  title           text not null check (char_length(title) between 1 and 200),
  description     text check (char_length(description) <= 4000),
  status          public.meeting_status not null default 'scheduled',
  starts_at       timestamptz,
  ends_at         timestamptz,
  livekit_room    text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, id),
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  foreign key (org_id, conversation_id)
    references public.conversations (org_id, id) on delete set null (conversation_id)
);
create index meetings_org_starts_idx on public.meetings (org_id, starts_at);
create index meetings_host_idx on public.meetings (host_id);

create table public.meeting_invites (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  meeting_id   uuid not null,
  user_id      uuid not null,
  status       public.meeting_invite_status not null default 'pending',
  responded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (meeting_id, user_id),
  foreign key (org_id, meeting_id)
    references public.meetings (org_id, id) on delete cascade,
  foreign key (org_id, user_id)
    references public.memberships (org_id, user_id) on delete cascade
);
create index meeting_invites_org_idx on public.meeting_invites (org_id);
create index meeting_invites_user_idx on public.meeting_invites (user_id);

-- -----------------------------------------------------------------------------
-- calls / call_participants
-- -----------------------------------------------------------------------------
create table public.calls (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  initiated_by    uuid references public.profiles (id) on delete set null,
  conversation_id uuid,
  meeting_id      uuid,
  kind            public.call_kind not null default 'audio',
  status          public.call_status not null default 'ringing',
  livekit_room    text unique,
  answered_at     timestamptz,
  ended_at        timestamptz,
  end_reason      text check (char_length(end_reason) <= 200),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, conversation_id)
    references public.conversations (org_id, id) on delete set null (conversation_id),
  foreign key (org_id, meeting_id)
    references public.meetings (org_id, id) on delete set null (meeting_id)
);
create index calls_org_created_idx on public.calls (org_id, created_at desc);
create index calls_initiated_by_idx on public.calls (initiated_by);
create index calls_conversation_idx on public.calls (conversation_id);
create index calls_meeting_idx on public.calls (meeting_id);

create table public.call_participants (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  call_id    uuid not null,
  user_id    uuid not null,
  status     public.call_participant_status not null default 'invited',
  joined_at  timestamptz,
  left_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (call_id, user_id),
  foreign key (org_id, call_id)
    references public.calls (org_id, id) on delete cascade,
  foreign key (org_id, user_id)
    references public.memberships (org_id, user_id) on delete cascade
);
create index call_participants_org_idx on public.call_participants (org_id);
create index call_participants_user_status_idx on public.call_participants (user_id, status);

-- -----------------------------------------------------------------------------
-- notifications (in-app). Payload carries ids, never message content.
-- -----------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        public.notification_kind not null,
  actor_id    uuid references public.profiles (id) on delete set null,
  entity_type text check (char_length(entity_type) <= 60),
  entity_id   uuid,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index notifications_org_idx on public.notifications (org_id);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

-- -----------------------------------------------------------------------------
-- push_subscriptions (global, per user device)
-- -----------------------------------------------------------------------------
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique check (endpoint like 'https://%'),
  p256dh      text not null,
  auth        text not null,
  user_agent  text check (char_length(user_agent) <= 500),
  -- e.g. {"enabled":true,"start":"22:00","end":"07:00","timezone":"Asia/Dubai"}
  quiet_hours jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- -----------------------------------------------------------------------------
-- ai_jobs (opt-in AI processing with recorded consent; output is a draft until
-- a human approves it)
-- -----------------------------------------------------------------------------
create table public.ai_jobs (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations (id) on delete cascade,
  kind                   public.ai_job_kind not null,
  status                 public.ai_job_status not null default 'pending_consent',
  -- Source: a meeting, or a conversation (optionally a single message in it).
  meeting_id             uuid,
  conversation_id        uuid,
  message_id             uuid,
  requested_by           uuid references public.profiles (id) on delete set null,
  -- Who must consent (computed server-side by request_ai_job) and who has.
  consent_required_from  uuid[] not null default '{}',
  consent_given_by       uuid[] not null default '{}',
  consent_at             timestamptz,
  source_language        text check (char_length(source_language) <= 16),
  target_language        text check (char_length(target_language) <= 16),
  output                 jsonb,
  error                  text check (char_length(error) <= 2000),
  approved_by            uuid references public.profiles (id) on delete set null,
  approved_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (meeting_id is not null or conversation_id is not null),
  check (message_id is null or conversation_id is not null),
  -- Consent is complete only when everyone required has given it.
  check (consent_at is null or consent_given_by @> consent_required_from),
  -- No processing or output without recorded consent ('rejected' also covers
  -- a participant declining consent).
  check (status in ('pending_consent', 'rejected', 'deleted', 'failed') or consent_at is not null),
  check (status not in ('pending_consent', 'queued') or output is null),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null)),
  foreign key (org_id, meeting_id)
    references public.meetings (org_id, id) on delete cascade,
  foreign key (org_id, conversation_id)
    references public.conversations (org_id, id) on delete cascade,
  foreign key (conversation_id, message_id)
    references public.messages (conversation_id, id) on delete cascade
);
create index ai_jobs_org_created_idx on public.ai_jobs (org_id, created_at desc);
create index ai_jobs_meeting_idx on public.ai_jobs (meeting_id);
create index ai_jobs_conversation_idx on public.ai_jobs (conversation_id);
create index ai_jobs_message_idx on public.ai_jobs (message_id);

-- -----------------------------------------------------------------------------
-- audit_events (append-only; no updated_at). actor_id intentionally has no FK
-- so audit history survives user deletion without being rewritten.
-- -----------------------------------------------------------------------------
create table public.audit_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  actor_id    uuid,
  action      text not null check (char_length(action) between 1 and 100),
  target_type text check (char_length(target_type) <= 60),
  target_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_events_org_created_idx on public.audit_events (org_id, created_at desc);
create index audit_events_actor_idx on public.audit_events (actor_id);

-- Append-only: block UPDATE for everyone (including service role). DELETE is
-- left to the org cascade and to service-role retention jobs.
create or replace function public.prevent_audit_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events is append-only' using errcode = '42501';
end;
$$;

create trigger audit_events_no_update
  before update on public.audit_events
  for each row execute function public.prevent_audit_update();

-- -----------------------------------------------------------------------------
-- updated_at triggers (every table except audit_events)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'profiles', 'departments', 'memberships', 'office_layouts',
    'office_seats', 'org_invitations', 'conversations', 'conversation_members',
    'messages', 'message_attachments', 'message_receipts', 'meetings',
    'meeting_invites', 'calls', 'call_participants', 'notifications',
    'push_subscriptions', 'ai_jobs'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Message bookkeeping triggers
-- -----------------------------------------------------------------------------
-- Maintain edited_at, and wipe content on soft delete (privacy: a deleted
-- message keeps its row for thread continuity but not its text).
create or replace function public.messages_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.deleted_at is not null and new.deleted_at is null then
    raise exception 'a deleted message cannot be restored' using errcode = '42501';
  end if;
  if new.deleted_at is not null then
    new.body := '';
  elsif new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger messages_before_update
  before update on public.messages
  for each row execute function public.messages_before_update();

-- Bump conversations.last_message_at (runs as owner: members cannot update
-- conversations directly).
create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
     set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at)
   where id = new.conversation_id;
  return null;
end;
$$;

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.messages_after_insert();
