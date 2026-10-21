-- =============================================================================
-- Phase 3: messaging.
--
--  * Browsable channels: a channel can be 'public' (any org member can see its
--    name/topic and join) or 'private' (members only). Messages are ALWAYS
--    members-only: you must join a public channel to read it.
--  * Read receipts are a per-member watermark (conversation_members.last_read_at).
--    Other members only see shared_read_at, which is null when the reader turned
--    off profiles.share_read_receipts. last_read_at / muted_until stay private.
--  * Real-time delivery uses PRIVATE Realtime Broadcast channels fed by triggers
--    (realtime.send), never client-sent events:
--      conversation:<id>          server events, members may read
--      conversation:<id>:typing   typing indicator, members may read + send
--      user:<id>:inbox            "something changed in conversation X", self only
--    Clients can only write to the typing topic, so they cannot forge messages.
--  * Messages are sent through send_message() (security invoker: RLS still
--    applies) so text + attachments land atomically and retries with the same
--    client_id are idempotent.
--  * Deleting a message is a soft delete only (text wiped, attachments rows
--    removed). Hard delete by clients is no longer allowed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schema changes
-- -----------------------------------------------------------------------------
create type public.conversation_visibility as enum ('private', 'public');

alter table public.conversations
  add column visibility public.conversation_visibility not null default 'private',
  add constraint conversations_public_only_channels check (visibility = 'private' or kind = 'channel');

create unique index conversations_channel_name_unique
  on public.conversations (org_id, lower(name)) where kind = 'channel';
create index conversations_org_public_channels_idx
  on public.conversations (org_id) where kind = 'channel' and visibility = 'public';

alter table public.profiles
  add column share_read_receipts boolean not null default true;
grant update (share_read_receipts) on public.profiles to authenticated;

-- What other members may see of your read position (null = not shared).
alter table public.conversation_members
  add column shared_read_at timestamptz;

-- Hide private columns of other people's memberships (read position, mute,
-- and updated_at, which would leak when someone last read).
revoke select on public.conversation_members from authenticated;
grant select (id, org_id, conversation_id, user_id, role, shared_read_at, created_at)
  on public.conversation_members to authenticated;

-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------
drop policy conversations_select_members on public.conversations;
create policy conversations_select_members_or_public on public.conversations
  for select to authenticated
  using (
    public.is_conversation_member(id)
    or (kind = 'channel' and visibility = 'public' and public.is_org_member(org_id))
  );

-- DMs cannot be left (membership is fixed); groups and channels can.
drop policy conversation_members_delete_self_or_owner on public.conversation_members;
create policy conversation_members_delete_self_or_owner on public.conversation_members
  for delete to authenticated
  using (
    (
      user_id = (select auth.uid())
      and exists (select 1 from public.conversations c where c.id = conversation_id and c.kind <> 'direct')
    )
    or public.can_manage_conversation(conversation_id)
  );

-- Soft delete only.
drop policy messages_delete_own on public.messages;

-- Attachments only on your own, non-deleted messages.
drop policy message_attachments_insert_own_message on public.message_attachments;
create policy message_attachments_insert_own_message on public.message_attachments
  for insert to authenticated
  with check (
    uploader_id = (select auth.uid())
    and public.is_conversation_member(conversation_id)
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.sender_id = (select auth.uid()) and m.deleted_at is null
    )
  );

-- Per-message receipts would reveal read state even when the reader opted out,
-- so they are visible only to their owner. (Reserved for delivery tracking in Phase 5.)
drop policy message_receipts_select_members on public.message_receipts;
create policy message_receipts_select_own on public.message_receipts
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Realtime now uses Broadcast; drop row-change streaming for chat tables
-- (conversation_members rows would otherwise stream private columns).
do $$
declare
  t text;
begin
  foreach t in array array['messages', 'message_receipts', 'conversation_members']
  loop
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end;
$$;

-- Whatever path inserts an attachment row, it must point at an object the
-- uploader stored, and its size/type come from storage, never from the client.
-- (The bucket's MIME allow-list already rejected anything else at upload.)
create or replace function public.message_attachments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb;
begin
  select o.metadata into v_meta
  from storage.objects o
  where o.bucket_id = new.bucket and o.name = new.storage_path
    and (new.uploader_id is null or o.owner_id = new.uploader_id::text or o.owner = new.uploader_id);
  if not found then
    raise exception 'attachment object not found for this uploader' using errcode = '42501';
  end if;
  new.mime_type := coalesce(v_meta ->> 'mimetype', new.mime_type);
  new.size_bytes := coalesce((v_meta ->> 'size')::bigint, new.size_bytes);
  return new;
end;
$$;

create trigger message_attachments_before_insert
  before insert on public.message_attachments
  for each row execute function public.message_attachments_before_insert();

-- -----------------------------------------------------------------------------
-- Read watermark: monotonic, never in the future, mirrored to shared_read_at
-- -----------------------------------------------------------------------------
create or replace function public.conversation_members_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share boolean;
begin
  -- least()/greatest() skip NULLs, so guard explicitly: NULL means "never read".
  if new.last_read_at is not null then
    new.last_read_at := least(new.last_read_at, now());
  end if;
  if tg_op = 'UPDATE' then
    new.last_read_at := greatest(old.last_read_at, new.last_read_at);
  end if;
  select p.share_read_receipts into v_share from public.profiles p where p.id = new.user_id;
  new.shared_read_at := case when coalesce(v_share, false) then new.last_read_at end;
  return new;
end;
$$;

create trigger conversation_members_before_write
  before insert or update on public.conversation_members
  for each row execute function public.conversation_members_before_write();

-- Toggling the setting re-derives shared_read_at everywhere (the trigger above does the work).
create or replace function public.profiles_after_share_receipts_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversation_members set shared_read_at = null where user_id = new.id;
  return null;
end;
$$;

create trigger profiles_after_share_receipts_change
  after update of share_read_receipts on public.profiles
  for each row
  when (old.share_read_receipts is distinct from new.share_read_receipts)
  execute function public.profiles_after_share_receipts_change();

-- -----------------------------------------------------------------------------
-- Realtime topics
-- -----------------------------------------------------------------------------
create or replace function public.realtime_topic_conversation(topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when topic = 'conversation:' || split_part(topic, ':', 2)
      then public.try_uuid(split_part(topic, ':', 2))
  end;
$$;

create or replace function public.realtime_topic_typing(topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when topic = 'conversation:' || split_part(topic, ':', 2) || ':typing'
      then public.try_uuid(split_part(topic, ':', 2))
  end;
$$;

create or replace function public.realtime_topic_inbox(topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when topic = 'user:' || split_part(topic, ':', 2) || ':inbox'
      then public.try_uuid(split_part(topic, ':', 2))
  end;
$$;

-- Realtime evaluates these when a client joins a private channel.
create policy "members receive conversation broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (
      public.is_conversation_member(public.realtime_topic_conversation(realtime.topic()))
      or public.is_conversation_member(public.realtime_topic_typing(realtime.topic()))
      or public.realtime_topic_inbox(realtime.topic()) = (select auth.uid())
    )
  );

create policy "members send typing broadcasts"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and public.is_conversation_member(public.realtime_topic_typing(realtime.topic()))
  );

-- -----------------------------------------------------------------------------
-- Broadcast helpers
-- -----------------------------------------------------------------------------
-- A Realtime outage must never make sending a message fail: log and carry on.
-- Clients re-fetch on reconnect, so a missed broadcast is recovered.
create or replace function public.realtime_broadcast(p_topic text, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(p_payload, p_event, p_topic, true);
exception when others then
  raise warning 'realtime broadcast to % failed: %', p_topic, sqlerrm;
end;
$$;

-- SECURITY INVOKER: callers only get messages their RLS policies allow.
create or replace function public.message_payload(p_message_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'conversation_id', m.conversation_id,
    'sender_id', m.sender_id,
    'body', m.body,
    'kind', m.kind,
    'reply_to_id', m.reply_to_id,
    'client_id', m.client_id,
    'edited_at', m.edited_at,
    'deleted_at', m.deleted_at,
    'created_at', m.created_at,
    'attachments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'storage_path', a.storage_path,
        'file_name', a.file_name,
        'mime_type', a.mime_type,
        'size_bytes', a.size_bytes,
        'duration_ms', a.duration_ms
      ) order by a.created_at)
      from public.message_attachments a
      where a.message_id = m.id
    ), '[]'::jsonb)
  )
  from public.messages m
  where m.id = p_message_id;
$$;

-- New message: full payload to the conversation, a content-free ping to each
-- other member's inbox. Deferred to commit so attachments inserted in the same
-- transaction are included.
create or replace function public.messages_broadcast_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid;
begin
  perform public.realtime_broadcast('conversation:' || new.conversation_id, 'message_created',
    public.message_payload(new.id));

  for v_member in
    select cm.user_id from public.conversation_members cm
    where cm.conversation_id = new.conversation_id and cm.user_id is distinct from new.sender_id
  loop
    perform public.realtime_broadcast('user:' || v_member || ':inbox', 'message',
      jsonb_build_object(
        'conversation_id', new.conversation_id,
        'message_id', new.id,
        'sender_id', new.sender_id,
        'created_at', new.created_at));
  end loop;
  return null;
end;
$$;

create constraint trigger messages_broadcast_insert
  after insert on public.messages
  deferrable initially deferred
  for each row execute function public.messages_broadcast_insert();

create or replace function public.messages_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    delete from public.message_attachments where message_id = new.id;
  end if;
  if new.body is distinct from old.body or new.deleted_at is distinct from old.deleted_at then
    perform public.realtime_broadcast('conversation:' || new.conversation_id, 'message_updated',
      jsonb_build_object(
        'id', new.id,
        'body', new.body,
        'edited_at', new.edited_at,
        'deleted_at', new.deleted_at));
  end if;
  return null;
end;
$$;

create trigger messages_after_update
  after update on public.messages
  for each row execute function public.messages_after_update();

create or replace function public.conversation_members_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.realtime_broadcast('user:' || new.user_id || ':inbox', 'conversation_added',
      jsonb_build_object('conversation_id', new.conversation_id));
    perform public.realtime_broadcast('conversation:' || new.conversation_id, 'members_changed',
      jsonb_build_object('user_id', new.user_id));
  elsif tg_op = 'DELETE' then
    perform public.realtime_broadcast('user:' || old.user_id || ':inbox', 'conversation_removed',
      jsonb_build_object('conversation_id', old.conversation_id));
    perform public.realtime_broadcast('conversation:' || old.conversation_id, 'members_changed',
      jsonb_build_object('user_id', old.user_id));
  elsif new.shared_read_at is distinct from old.shared_read_at then
    perform public.realtime_broadcast('conversation:' || new.conversation_id, 'read',
      jsonb_build_object('user_id', new.user_id, 'read_at', new.shared_read_at));
  end if;
  return null;
end;
$$;

create trigger conversation_members_after_change
  after insert or update or delete on public.conversation_members
  for each row execute function public.conversation_members_after_change();

-- -----------------------------------------------------------------------------
-- RPC: create_conversation (adds p_visibility; re-joins an existing DM)
-- -----------------------------------------------------------------------------
drop function public.create_conversation(uuid, public.conversation_kind, uuid[], text, text);

create or replace function public.create_conversation(
  p_org_id     uuid,
  p_kind       public.conversation_kind,
  p_member_ids uuid[],
  p_name       text default null,
  p_topic      text default null,
  p_visibility public.conversation_visibility default 'private'
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
  if p_visibility = 'public' and p_kind <> 'channel' then
    raise exception 'only channels can be public' using errcode = '22023';
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
  elsif p_kind = 'group' and cardinality(v_members) < 2 then
    raise exception 'a group needs at least one other member' using errcode = '22023';
  end if;

  insert into public.conversations (org_id, kind, name, topic, direct_key, created_by, visibility)
  values (p_org_id, p_kind,
          case when p_kind = 'direct' then null else nullif(btrim(p_name), '') end,
          nullif(btrim(p_topic), ''), v_key, v_uid, p_visibility)
  returning id into v_conv;

  insert into public.conversation_members (org_id, conversation_id, user_id, role)
  select p_org_id, v_conv, u,
         (case when u = v_uid and p_kind <> 'direct' then 'owner' else 'member' end)::public.conversation_member_role
  from unnest(v_members) as u;

  return v_conv;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: join_channel — any org member may join a public channel
-- -----------------------------------------------------------------------------
create or replace function public.join_channel(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select c.org_id into v_org
  from public.conversations c
  where c.id = p_conversation_id and c.kind = 'channel' and c.visibility = 'public';
  if v_org is null or not public.is_org_member(v_org) then
    raise exception 'channel not found' using errcode = '42501';
  end if;

  -- Start fully read: joining does not mark the whole history unread.
  insert into public.conversation_members (org_id, conversation_id, user_id, role, last_read_at)
  values (v_org, p_conversation_id, v_uid, 'member', now())
  on conflict (conversation_id, user_id) do nothing;

  return p_conversation_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: send_message — atomic text + attachments, idempotent per client_id.
-- SECURITY INVOKER: the caller's RLS policies apply to every insert.
-- p_attachments: [{"storage_path": "...", "file_name": "...", "duration_ms": null}]
-- Size and MIME type are taken from the stored object, not from the client.
-- -----------------------------------------------------------------------------
create or replace function public.send_message(
  p_conversation_id uuid,
  p_body            text,
  p_client_id       uuid,
  p_reply_to_id     uuid default null,
  p_attachments     jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_org     uuid;
  v_body    text := btrim(coalesce(p_body, ''), E' \t\r\n');
  v_count   int := coalesce(jsonb_array_length(p_attachments), 0);
  v_id      uuid;
  v_existing_conv uuid;
  v_att     jsonb;
  v_path    text;
  v_object  record;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_client_id is null then
    raise exception 'client_id is required' using errcode = '22023';
  end if;
  if v_body = '' and v_count = 0 then
    raise exception 'message is empty' using errcode = '22023';
  end if;
  if v_count > 10 then
    raise exception 'at most 10 attachments per message' using errcode = '22023';
  end if;

  -- Retry of a message that already landed (client ids are per sender, so a
  -- reused id from another conversation is a client bug, not a retry).
  select m.id, m.conversation_id into v_id, v_existing_conv from public.messages m
  where m.sender_id = v_uid and m.client_id = p_client_id;
  if v_id is not null then
    if v_existing_conv <> p_conversation_id then
      raise exception 'client_id already used in another conversation' using errcode = '22023';
    end if;
    return public.message_payload(v_id);
  end if;

  select c.org_id into v_org from public.conversations c
  where c.id = p_conversation_id and public.is_conversation_member(c.id);
  if v_org is null then
    raise exception 'not a member of this conversation' using errcode = '42501';
  end if;

  insert into public.messages (org_id, conversation_id, sender_id, body, kind, reply_to_id, client_id)
  values (v_org, p_conversation_id, v_uid, v_body,
          (case when v_count > 0 then 'file' else 'text' end)::public.message_kind,
          p_reply_to_id, p_client_id)
  on conflict (sender_id, client_id) do nothing
  returning id into v_id;

  if v_id is null then
    -- Lost a race with a concurrent retry of the same message.
    select m.id into v_id from public.messages m
    where m.sender_id = v_uid and m.client_id = p_client_id and m.conversation_id = p_conversation_id;
    if v_id is null then
      raise exception 'client_id already used in another conversation' using errcode = '22023';
    end if;
    return public.message_payload(v_id);
  end if;

  for v_att in select * from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb))
  loop
    v_path := v_att ->> 'storage_path';
    if v_path is null or v_path not like v_org::text || '/' || p_conversation_id::text || '/%' then
      raise exception 'attachment path is outside this conversation' using errcode = '42501';
    end if;

    select o.metadata into v_object
    from storage.objects o
    where o.bucket_id = 'attachments' and o.name = v_path
      and (o.owner_id = v_uid::text or o.owner = v_uid);
    if not found then
      raise exception 'attachment was not uploaded by you' using errcode = '42501';
    end if;

    insert into public.message_attachments
      (org_id, conversation_id, message_id, uploader_id, storage_path, file_name, mime_type, size_bytes, duration_ms)
    values (
      v_org, p_conversation_id, v_id, v_uid, v_path,
      left(coalesce(nullif(btrim(v_att ->> 'file_name'), ''), 'file'), 255),
      coalesce(v_object.metadata ->> 'mimetype', 'application/octet-stream'),
      coalesce((v_object.metadata ->> 'size')::bigint, 0),
      (v_att ->> 'duration_ms')::integer
    );
  end loop;

  return public.message_payload(v_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: list_conversations — the caller's inbox with unread counts
-- -----------------------------------------------------------------------------
create or replace function public.list_conversations(p_org_id uuid)
returns table (
  id               uuid,
  kind             public.conversation_kind,
  visibility       public.conversation_visibility,
  name             text,
  topic            text,
  last_message_at  timestamptz,
  last_read_at     timestamptz,
  muted_until      timestamptz,
  unread_count     integer,
  member_count     integer,
  member_ids       uuid[],
  last_message     jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.kind, c.visibility, c.name, c.topic, c.last_message_at,
    me.last_read_at, me.muted_until,
    (
      select count(*)::int from (
        select 1 from public.messages m
        where m.conversation_id = c.id
          and m.created_at > coalesce(me.last_read_at, '-infinity'::timestamptz)
          and m.sender_id is distinct from me.user_id
          and m.deleted_at is null
        limit 100
      ) unread
    ) as unread_count,
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id) as member_count,
    -- Enough to name a DM or an unnamed group; never the whole roster of a big channel.
    array(
      select x.user_id from public.conversation_members x
      where x.conversation_id = c.id and x.user_id <> me.user_id
      order by x.created_at
      limit 4
    ) as member_ids,
    (
      select jsonb_build_object(
        'id', m.id, 'sender_id', m.sender_id, 'kind', m.kind,
        'body', left(m.body, 140), 'deleted', m.deleted_at is not null, 'created_at', m.created_at)
      from public.messages m
      where m.conversation_id = c.id
      order by m.created_at desc
      limit 1
    ) as last_message
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  where me.user_id = auth.uid()
    and c.org_id = p_org_id
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

-- -----------------------------------------------------------------------------
-- RPC: browse_channels — public channels of the caller's org
-- -----------------------------------------------------------------------------
create or replace function public.browse_channels(p_org_id uuid)
returns table (
  id              uuid,
  name            text,
  topic           text,
  member_count    integer,
  is_member       boolean,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.name, c.topic,
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
    exists (select 1 from public.conversation_members x where x.conversation_id = c.id and x.user_id = auth.uid()),
    c.last_message_at
  from public.conversations c
  where c.org_id = p_org_id
    and c.kind = 'channel'
    and c.visibility = 'public'
    and public.is_org_member(p_org_id)
  order by lower(c.name);
$$;

-- -----------------------------------------------------------------------------
-- Function privileges. Supabase grants EXECUTE on new functions to anon AND
-- authenticated by default, so revoke from all client roles, then grant back only
-- the RPCs/helpers clients may call. Trigger functions still fire after the revoke.
-- -----------------------------------------------------------------------------
revoke execute on function
  public.realtime_broadcast(text, text, jsonb),
  public.conversation_members_before_write(),
  public.profiles_after_share_receipts_change(),
  public.realtime_topic_conversation(text),
  public.realtime_topic_typing(text),
  public.realtime_topic_inbox(text),
  public.message_payload(uuid),
  public.messages_broadcast_insert(),
  public.messages_after_update(),
  public.conversation_members_after_change(),
  public.create_conversation(uuid, public.conversation_kind, uuid[], text, text, public.conversation_visibility),
  public.join_channel(uuid),
  public.send_message(uuid, text, uuid, uuid, jsonb),
  public.list_conversations(uuid),
  public.browse_channels(uuid),
  public.message_attachments_before_insert()
from public, anon, authenticated;

grant execute on function
  public.realtime_topic_conversation(text),
  public.realtime_topic_typing(text),
  public.realtime_topic_inbox(text),
  public.message_payload(uuid),
  public.create_conversation(uuid, public.conversation_kind, uuid[], text, text, public.conversation_visibility),
  public.join_channel(uuid),
  public.send_message(uuid, text, uuid, uuid, jsonb),
  public.list_conversations(uuid),
  public.browse_channels(uuid)
to authenticated, service_role;
