-- =============================================================================
-- TeamVerse AI: Row Level Security, helper functions, RPCs, auth trigger,
-- realtime publication.
-- =============================================================================
-- Principles
--  * RLS is enabled on every table. anon has no table privileges at all.
--  * Helper functions are SECURITY DEFINER, STABLE, `set search_path = ''`, and
--    use fully-qualified names. They run as the table owner and so bypass RLS,
--    which avoids policy recursion.
--  * Private chat content (conversations, members, messages, attachments,
--    receipts) is visible ONLY to conversation members. Org admins/owners get
--    NO bypass.
--  * Column-level UPDATE grants stop users from moving rows between tenants or
--    rewriting ownership columns; RLS decides which rows.
--  * TRUNCATE bypasses RLS, so it is revoked from client roles.
--  * Mutations that need invariants (creating conversations, accepting invites,
--    AI consent) go through SECURITY DEFINER RPCs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------
alter table public.organizations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.departments          enable row level security;
alter table public.memberships          enable row level security;
alter table public.office_layouts       enable row level security;
alter table public.office_seats         enable row level security;
alter table public.org_invitations      enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.message_attachments  enable row level security;
alter table public.message_receipts     enable row level security;
alter table public.meetings             enable row level security;
alter table public.meeting_invites      enable row level security;
alter table public.calls                enable row level security;
alter table public.call_participants    enable row level security;
alter table public.notifications        enable row level security;
alter table public.push_subscriptions   enable row level security;
alter table public.ai_jobs              enable row level security;
alter table public.audit_events         enable row level security;

-- -----------------------------------------------------------------------------
-- Table privileges
-- -----------------------------------------------------------------------------
-- anon: nothing. The only anon entry point is public.invitation_preview().
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- TRUNCATE ignores RLS; REFERENCES/TRIGGER are never needed by clients.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- organizations: created by the server (service role). Owners may rename.
revoke insert, update, delete on public.organizations from authenticated;
grant update (name, timezone) on public.organizations to authenticated;

-- profiles: created by the auth trigger; users edit their own settings.
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, avatar_url, title, timezone, locale, availability,
              reduced_motion, low_bandwidth) on public.profiles to authenticated;

revoke update on public.memberships from authenticated;
grant update (role, department_id) on public.memberships to authenticated;

revoke update on public.departments from authenticated;
grant update (name, slug, color_token, sort_order) on public.departments to authenticated;

revoke update on public.office_layouts from authenticated;
grant update (name, is_active, scene) on public.office_layouts to authenticated;

revoke update on public.office_seats from authenticated;
grant update (department_id, label, position, assigned_user_id) on public.office_seats to authenticated;

-- org_invitations: never hard-deleted by clients (revoke instead); acceptance
-- only through accept_invitation().
revoke update, delete on public.org_invitations from authenticated;
grant update (role, department_id, expires_at, revoked_at) on public.org_invitations to authenticated;

-- conversations: created through create_conversation().
revoke insert, update, delete on public.conversations from authenticated;
grant update (name, topic) on public.conversations to authenticated;

revoke update on public.conversation_members from authenticated;
grant update (last_read_at, muted_until) on public.conversation_members to authenticated;

-- messages: edit body or soft delete only (edited_at is set by trigger).
revoke update on public.messages from authenticated;
grant update (body, deleted_at) on public.messages to authenticated;

revoke update on public.message_attachments from authenticated;

revoke update, delete on public.message_receipts from authenticated;
grant update (delivered_at, read_at) on public.message_receipts to authenticated;

revoke update on public.meetings from authenticated;
grant update (title, description, status, starts_at, ends_at) on public.meetings to authenticated;

revoke update on public.meeting_invites from authenticated;
grant update (status, responded_at) on public.meeting_invites to authenticated;

revoke update, delete on public.calls from authenticated;
grant update (status, answered_at, ended_at, end_reason) on public.calls to authenticated;

revoke update, delete on public.call_participants from authenticated;
grant update (status, joined_at, left_at) on public.call_participants to authenticated;

-- notifications: written by the server; users mark read or dismiss.
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke update on public.push_subscriptions from authenticated;
grant update (p256dh, auth, user_agent, quiet_hours) on public.push_subscriptions to authenticated;

-- ai_jobs: read-only for clients; all writes via RPCs or the service role.
revoke insert, update, delete on public.ai_jobs from authenticated;

-- audit_events: read-only for clients (and only admins, via RLS).
revoke insert, update, delete on public.audit_events from authenticated;

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(org uuid, roles public.membership_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = auth.uid() and m.role = any (roles)
  );
$$;

create or replace function public.is_conversation_member(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conv and cm.user_id = auth.uid()
  );
$$;

-- True when the caller shares at least one org with `other` (profile visibility).
create or replace function public.shares_org_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  );
$$;

-- Conversation owner of a group/channel (DM membership is fixed).
create or replace function public.can_manage_conversation(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.conversation_id = conv
      and cm.user_id = auth.uid()
      and cm.role = 'owner'
      and c.kind <> 'direct'
  );
$$;

-- Meeting host or invitee.
create or replace function public.is_meeting_participant(meeting uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meetings mt
    where mt.id = meeting and mt.host_id = auth.uid()
  ) or exists (
    select 1 from public.meeting_invites mi
    where mi.meeting_id = meeting and mi.user_id = auth.uid()
  );
$$;

-- Call initiator (host) or participant.
create or replace function public.is_call_participant(call uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.calls c
    where c.id = call and c.initiated_by = auth.uid()
  ) or exists (
    select 1 from public.call_participants cp
    where cp.call_id = call and cp.user_id = auth.uid()
  );
$$;

-- Whether the caller may add THEMSELVES to a call: they are the host, or the
-- call belongs to a meeting they are invited to, or to a conversation they are
-- a member of (group/channel calls).
create or replace function public.can_join_call(call uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.calls c
    where c.id = call
      and (
        c.initiated_by = auth.uid()
        or (c.meeting_id is not null and public.is_meeting_participant(c.meeting_id))
        or (c.conversation_id is not null and public.is_conversation_member(c.conversation_id))
      )
  );
$$;

-- Safe text -> uuid cast (null on malformed input) for storage path parsing.
create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

-- Internal: append an audit event. Not executable by client roles.
create or replace function public.log_audit_event(
  p_org_id uuid,
  p_action text,
  p_target_type text default null,
  p_target_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_events (org_id, actor_id, action, target_type, target_id, metadata)
  values (p_org_id, auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
$$;

-- -----------------------------------------------------------------------------
-- Policies: organizations
-- -----------------------------------------------------------------------------
create policy organizations_select_members on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

create policy organizations_update_owners on public.organizations
  for update to authenticated
  using (public.has_org_role(id, array['owner']::public.membership_role[]))
  with check (public.has_org_role(id, array['owner']::public.membership_role[]));

-- -----------------------------------------------------------------------------
-- Policies: profiles
-- -----------------------------------------------------------------------------
create policy profiles_select_self_or_shared_org on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_org_with(id));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Policies: memberships
-- Admins/owners manage memberships. Only owners may create, modify or remove
-- an owner row, so nobody can escalate to owner unless already an owner.
-- Members may leave (delete their own non-owner row).
-- -----------------------------------------------------------------------------
create policy memberships_select_same_org on public.memberships
  for select to authenticated
  using (public.is_org_member(org_id));

create policy memberships_insert_admins on public.memberships
  for insert to authenticated
  with check (
    public.has_org_role(org_id, array['owner', 'admin']::public.membership_role[])
    and (role <> 'owner' or public.has_org_role(org_id, array['owner']::public.membership_role[]))
  );

create policy memberships_update_admins on public.memberships
  for update to authenticated
  using (
    public.has_org_role(org_id, array['owner', 'admin']::public.membership_role[])
    and (role <> 'owner' or public.has_org_role(org_id, array['owner']::public.membership_role[]))
  )
  with check (
    public.has_org_role(org_id, array['owner', 'admin']::public.membership_role[])
    and (role <> 'owner' or public.has_org_role(org_id, array['owner']::public.membership_role[]))
  );

create policy memberships_delete_admins_or_self on public.memberships
  for delete to authenticated
  using (
    (
      public.has_org_role(org_id, array['owner', 'admin']::public.membership_role[])
      and (role <> 'owner' or public.has_org_role(org_id, array['owner']::public.membership_role[]))
    )
    or (user_id = (select auth.uid()) and role <> 'owner')
  );

-- -----------------------------------------------------------------------------
-- Policies: departments, office_layouts, office_seats (members read, admins write)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['departments', 'office_layouts', 'office_seats']
  loop
    execute format($f$
      create policy %1$s_select_members on public.%1$I
        for select to authenticated
        using (public.is_org_member(org_id));
      create policy %1$s_insert_admins on public.%1$I
        for insert to authenticated
        with check (public.has_org_role(org_id, array['owner','admin']::public.membership_role[]));
      create policy %1$s_update_admins on public.%1$I
        for update to authenticated
        using (public.has_org_role(org_id, array['owner','admin']::public.membership_role[]))
        with check (public.has_org_role(org_id, array['owner','admin']::public.membership_role[]));
      create policy %1$s_delete_admins on public.%1$I
        for delete to authenticated
        using (public.has_org_role(org_id, array['owner','admin']::public.membership_role[]));
    $f$, t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Policies: org_invitations (admins only; invitees use the RPCs below)
-- -----------------------------------------------------------------------------
create policy org_invitations_select_admins on public.org_invitations
  for select to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.membership_role[]));

create policy org_invitations_insert_admins on public.org_invitations
  for insert to authenticated
  with check (
    public.has_org_role(org_id, array['owner', 'admin']::public.membership_role[])
    and invited_by = (select auth.uid())
    and accepted_at is null
    and (role <> 'owner' or public.has_org_role(org_id, array['owner']::public.membership_role[]))
  );

create policy org_invitations_update_admins on public.org_invitations
  for update to authenticated
  using (
    public.has_org_role(org_id, array['owner', 'admin']::public.membership_role[])
    and (role <> 'owner' or public.has_org_role(org_id, array['owner']::public.membership_role[]))
  )
  with check (
    public.has_org_role(org_id, array['owner', 'admin']::public.membership_role[])
    and (role <> 'owner' or public.has_org_role(org_id, array['owner']::public.membership_role[]))
  );

-- -----------------------------------------------------------------------------
-- Policies: conversations & chat content (members only, NO admin bypass)
-- -----------------------------------------------------------------------------
create policy conversations_select_members on public.conversations
  for select to authenticated
  using (public.is_conversation_member(id));

create policy conversations_update_owners on public.conversations
  for update to authenticated
  using (public.can_manage_conversation(id))
  with check (public.can_manage_conversation(id));

create policy conversation_members_select_members on public.conversation_members
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

-- Conversation owners add people to groups/channels. The composite FK to
-- memberships guarantees the new member belongs to the same org.
create policy conversation_members_insert_owners on public.conversation_members
  for insert to authenticated
  with check (public.can_manage_conversation(conversation_id) and role = 'member');

create policy conversation_members_update_self on public.conversation_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy conversation_members_delete_self_or_owner on public.conversation_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.can_manage_conversation(conversation_id));

create policy messages_select_members on public.messages
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy messages_insert_self_member on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and kind <> 'system'
    and deleted_at is null
    and edited_at is null
    and public.is_conversation_member(conversation_id)
  );

create policy messages_update_own on public.messages
  for update to authenticated
  using (sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id))
  with check (sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id));

create policy messages_delete_own on public.messages
  for delete to authenticated
  using (sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id));

create policy message_attachments_select_members on public.message_attachments
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy message_attachments_insert_own_message on public.message_attachments
  for insert to authenticated
  with check (
    uploader_id = (select auth.uid())
    and public.is_conversation_member(conversation_id)
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.sender_id = (select auth.uid())
    )
  );

create policy message_attachments_delete_own on public.message_attachments
  for delete to authenticated
  using (uploader_id = (select auth.uid()) and public.is_conversation_member(conversation_id));

create policy message_receipts_select_members on public.message_receipts
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy message_receipts_insert_self on public.message_receipts
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_conversation_member(conversation_id));

create policy message_receipts_update_self on public.message_receipts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Policies: meetings / meeting_invites (host + invitees)
-- -----------------------------------------------------------------------------
-- host_id is checked inline so INSERT ... RETURNING works (a STABLE helper
-- cannot see the row being inserted by the same statement).
create policy meetings_select_participants on public.meetings
  for select to authenticated
  using (host_id = (select auth.uid()) or public.is_meeting_participant(id));

create policy meetings_insert_host on public.meetings
  for insert to authenticated
  with check (
    host_id = (select auth.uid())
    and public.is_org_member(org_id)
    and (conversation_id is null or public.is_conversation_member(conversation_id))
  );

create policy meetings_update_host on public.meetings
  for update to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

create policy meetings_delete_host on public.meetings
  for delete to authenticated
  using (host_id = (select auth.uid()));

create policy meeting_invites_select_participants on public.meeting_invites
  for select to authenticated
  using (public.is_meeting_participant(meeting_id));

create policy meeting_invites_insert_host on public.meeting_invites
  for insert to authenticated
  with check (
    exists (
      select 1 from public.meetings mt
      where mt.id = meeting_id and mt.host_id = (select auth.uid())
    )
  );

create policy meeting_invites_update_invitee on public.meeting_invites
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy meeting_invites_delete_host_or_invitee on public.meeting_invites
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.meetings mt
      where mt.id = meeting_id and mt.host_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- Policies: calls / call_participants (host + participants)
-- -----------------------------------------------------------------------------
create policy calls_select_participants on public.calls
  for select to authenticated
  using (initiated_by = (select auth.uid()) or public.is_call_participant(id));

create policy calls_insert_initiator on public.calls
  for insert to authenticated
  with check (
    initiated_by = (select auth.uid())
    and public.is_org_member(org_id)
    and (conversation_id is null or public.is_conversation_member(conversation_id))
    and (meeting_id is null or public.is_meeting_participant(meeting_id))
  );

create policy calls_update_participants on public.calls
  for update to authenticated
  using (public.is_call_participant(id))
  with check (public.is_call_participant(id));

create policy call_participants_select_participants on public.call_participants
  for select to authenticated
  using (public.is_call_participant(call_id));

-- Host invites/rings anyone in the org (composite FK enforces org membership);
-- others may only add themselves to a call they are allowed to join.
create policy call_participants_insert_host_or_self on public.call_participants
  for insert to authenticated
  with check (
    exists (
      select 1 from public.calls c
      where c.id = call_id and c.initiated_by = (select auth.uid())
    )
    or (user_id = (select auth.uid()) and public.can_join_call(call_id))
  );

create policy call_participants_update_self on public.call_participants
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Policies: notifications / push_subscriptions (own rows only)
-- -----------------------------------------------------------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Policies: ai_jobs (members of the source conversation / meeting)
-- -----------------------------------------------------------------------------
create policy ai_jobs_select_source_members on public.ai_jobs
  for select to authenticated
  using (
    (meeting_id is not null and public.is_meeting_participant(meeting_id))
    or (conversation_id is not null and public.is_conversation_member(conversation_id))
  );

-- -----------------------------------------------------------------------------
-- Policies: audit_events (admins/owners read; no client writes at all)
-- -----------------------------------------------------------------------------
create policy audit_events_select_admins on public.audit_events
  for select to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.membership_role[]));

-- -----------------------------------------------------------------------------
-- RPC: invitation_preview (anon-callable, read-only)
-- Returns one row for a known token, no rows otherwise. Exposes only what the
-- invite page needs. Tokens are high-entropy secrets, so the email in the row
-- is only visible to whoever holds the invite link.
-- -----------------------------------------------------------------------------
create or replace function public.invitation_preview(raw_token text)
returns table (
  org_name   text,
  email      text,
  role       public.membership_role,
  expires_at timestamptz,
  status     text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.name,
    i.email,
    i.role,
    i.expires_at,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      else 'valid'
    end
  from public.org_invitations i
  join public.organizations o on o.id = i.org_id
  where raw_token is not null
    and char_length(raw_token) between 16 and 512
    and i.token_hash = encode(sha256(convert_to(raw_token, 'UTF8')), 'hex');
$$;

-- -----------------------------------------------------------------------------
-- RPC: accept_invitation
-- -----------------------------------------------------------------------------
create or replace function public.accept_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_inv   public.org_invitations%rowtype;
begin
  if v_uid is null or v_email is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if raw_token is null or char_length(raw_token) not between 16 and 512 then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  select * into v_inv
  from public.org_invitations
  where token_hash = encode(sha256(convert_to(raw_token, 'UTF8')), 'hex')
  for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'invitation revoked' using errcode = '22023';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'invitation already accepted' using errcode = '22023';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'invitation expired' using errcode = '22023';
  end if;
  if v_inv.email <> v_email then
    raise exception 'invitation email does not match signed-in user' using errcode = '42501';
  end if;

  -- An existing member keeps their current role (never escalated by an invite).
  insert into public.memberships (org_id, user_id, role, department_id)
  values (v_inv.org_id, v_uid, v_inv.role, v_inv.department_id)
  on conflict (org_id, user_id) do nothing;

  update public.org_invitations
     set accepted_at = now(), accepted_by = v_uid
   where id = v_inv.id;

  perform public.log_audit_event(
    v_inv.org_id, 'invitation.accepted', 'org_invitation', v_inv.id,
    jsonb_build_object('role', v_inv.role, 'department_id', v_inv.department_id)
  );

  return v_inv.org_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: create_conversation
-- Creates a DM / group / channel with the caller as a member (owner for
-- group/channel). For DMs, returns the existing conversation if there is one.
-- -----------------------------------------------------------------------------
create or replace function public.create_conversation(
  p_org_id     uuid,
  p_kind       public.conversation_kind,
  p_member_ids uuid[],
  p_name       text default null,
  p_topic      text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_members uuid[];
  v_key     text;
  v_conv    uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.is_org_member(p_org_id) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;

  select array_agg(distinct u) into v_members
  from unnest(coalesce(p_member_ids, '{}'::uuid[]) || v_uid) as u
  where u is not null;

  if exists (
    select 1 from unnest(v_members) as u
    where not exists (
      select 1 from public.memberships m where m.org_id = p_org_id and m.user_id = u
    )
  ) then
    raise exception 'all members must belong to the organization' using errcode = '42501';
  end if;

  if p_kind = 'direct' then
    if cardinality(v_members) <> 2 then
      raise exception 'a direct conversation needs exactly one other member' using errcode = '22023';
    end if;
    v_key := least(v_members[1]::text, v_members[2]::text) || ':' ||
             greatest(v_members[1]::text, v_members[2]::text);
    select c.id into v_conv
    from public.conversations c
    where c.org_id = p_org_id and c.direct_key = v_key;
    if found then
      return v_conv;
    end if;
  end if;

  insert into public.conversations (org_id, kind, name, topic, direct_key, created_by)
  values (p_org_id, p_kind,
          case when p_kind = 'direct' then null else p_name end,
          p_topic, v_key, v_uid)
  returning id into v_conv;

  insert into public.conversation_members (org_id, conversation_id, user_id, role)
  select p_org_id, v_conv, u,
         (case when u = v_uid and p_kind <> 'direct' then 'owner' else 'member' end)::public.conversation_member_role
  from unnest(v_members) as u;

  return v_conv;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs: AI jobs with explicit consent
--  * transcription / summary / action_items need consent from everyone in the
--    source (meeting host + non-declined invitees, or all conversation members).
--  * translation / draft need only the requester's consent.
--  * Requesting counts as the requester's own consent.
--  * Output is a draft until a participant approves (optionally correcting it).
-- -----------------------------------------------------------------------------
create or replace function public.request_ai_job(
  p_kind            public.ai_job_kind,
  p_meeting_id      uuid default null,
  p_conversation_id uuid default null,
  p_message_id      uuid default null,
  p_target_language text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_org      uuid;
  v_required uuid[];
  v_job      uuid;
  v_complete boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if (p_meeting_id is null) = (p_conversation_id is null) then
    raise exception 'exactly one of meeting or conversation is required' using errcode = '22023';
  end if;

  if p_meeting_id is not null then
    if p_message_id is not null or not public.is_meeting_participant(p_meeting_id) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    select mt.org_id into v_org from public.meetings mt where mt.id = p_meeting_id;
    select array_agg(distinct u) into v_required from (
      select mt.host_id as u from public.meetings mt where mt.id = p_meeting_id and mt.host_id is not null
      union
      select mi.user_id from public.meeting_invites mi
      where mi.meeting_id = p_meeting_id and mi.status <> 'declined'
    ) s;
  else
    if not public.is_conversation_member(p_conversation_id) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    select c.org_id into v_org from public.conversations c where c.id = p_conversation_id;
    select array_agg(cm.user_id) into v_required
    from public.conversation_members cm where cm.conversation_id = p_conversation_id;
  end if;

  if p_kind in ('translation', 'draft') then
    v_required := array[v_uid];
  end if;
  v_required := coalesce(v_required, '{}'::uuid[]);
  v_complete := array[v_uid] @> v_required;

  insert into public.ai_jobs (
    org_id, kind, status, meeting_id, conversation_id, message_id, requested_by,
    consent_required_from, consent_given_by, consent_at, target_language
  ) values (
    v_org, p_kind,
    case when v_complete then 'queued' else 'pending_consent' end::public.ai_job_status,
    p_meeting_id, p_conversation_id, p_message_id, v_uid,
    v_required, array[v_uid], case when v_complete then now() end, p_target_language
  )
  returning id into v_job;

  perform public.log_audit_event(v_org, 'ai_job.requested', 'ai_job', v_job,
    jsonb_build_object('kind', p_kind));
  return v_job;
end;
$$;

create or replace function public.give_ai_consent(p_job_id uuid, p_consent boolean default true)
returns public.ai_job_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.ai_jobs%rowtype;
begin
  select * into v_job from public.ai_jobs where id = p_job_id for update;
  if not found or v_uid is null or not (v_uid = any (v_job.consent_required_from)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_job.status <> 'pending_consent' then
    raise exception 'job is not awaiting consent' using errcode = '22023';
  end if;

  if not p_consent then
    update public.ai_jobs set status = 'rejected' where id = p_job_id;
    perform public.log_audit_event(v_job.org_id, 'ai_job.consent_declined', 'ai_job', p_job_id);
    return 'rejected';
  end if;

  v_job.consent_given_by := array(
    select distinct u from unnest(v_job.consent_given_by || v_uid) as u
  );
  if v_job.consent_given_by @> v_job.consent_required_from then
    v_job.consent_at := now();
    v_job.status := 'queued';
  end if;

  update public.ai_jobs
     set consent_given_by = v_job.consent_given_by,
         consent_at = v_job.consent_at,
         status = v_job.status
   where id = p_job_id;

  perform public.log_audit_event(v_job.org_id, 'ai_job.consent_given', 'ai_job', p_job_id);
  return v_job.status;
end;
$$;

-- p_decision: 'approve' | 'reject' | 'delete'. p_output optionally replaces the
-- draft output on approve (human correction).
create or replace function public.review_ai_job(
  p_job_id   uuid,
  p_decision text,
  p_output   jsonb default null
)
returns public.ai_job_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.ai_jobs%rowtype;
  v_new public.ai_job_status;
begin
  select * into v_job from public.ai_jobs where id = p_job_id for update;
  if not found or v_uid is null or not (
    (v_job.meeting_id is not null and public.is_meeting_participant(v_job.meeting_id))
    or (v_job.conversation_id is not null and public.is_conversation_member(v_job.conversation_id))
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_decision = 'approve' and v_job.status = 'draft' then
    update public.ai_jobs
       set status = 'approved', output = coalesce(p_output, output),
           approved_by = v_uid, approved_at = now()
     where id = p_job_id;
    v_new := 'approved';
  elsif p_decision = 'reject' and v_job.status = 'draft' then
    update public.ai_jobs set status = 'rejected' where id = p_job_id;
    v_new := 'rejected';
  elsif p_decision = 'delete' then
    update public.ai_jobs set status = 'deleted', output = null where id = p_job_id;
    v_new := 'deleted';
  else
    raise exception 'invalid decision % for status %', p_decision, v_job.status using errcode = '22023';
  end if;

  perform public.log_audit_event(v_job.org_id, 'ai_job.' || p_decision, 'ai_job', p_job_id);
  return v_new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Auth trigger: create a profile for every new auth user
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    ), 120),
    lower(new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync when the auth email changes.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_org_member(uuid),
  public.has_org_role(uuid, public.membership_role[]),
  public.is_conversation_member(uuid),
  public.shares_org_with(uuid),
  public.can_manage_conversation(uuid),
  public.is_meeting_participant(uuid),
  public.is_call_participant(uuid),
  public.can_join_call(uuid),
  public.try_uuid(text),
  public.accept_invitation(text),
  public.create_conversation(uuid, public.conversation_kind, uuid[], text, text),
  public.request_ai_job(public.ai_job_kind, uuid, uuid, uuid, text),
  public.give_ai_consent(uuid, boolean),
  public.review_ai_job(uuid, text, jsonb),
  public.invitation_preview(text)
to authenticated, service_role;

-- The invite landing page runs before sign-in.
grant execute on function public.invitation_preview(text) to anon;

grant execute on function public.log_audit_event(uuid, text, text, uuid, jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- Realtime: broadcast row changes (RLS-filtered per subscriber)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'publication supabase_realtime not found; skipping realtime setup';
    return;
  end if;
  foreach t in array array['messages', 'message_receipts', 'conversation_members', 'notifications']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
