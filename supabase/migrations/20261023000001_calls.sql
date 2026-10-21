-- =============================================================================
-- Phase 4: calls (1:1 audio/video) and huddles (group calls in a conversation).
--
--  * Clients never write calls/call_participants directly; RPCs below enforce
--    the state machine (ringing -> active -> ended/missed/declined).
--  * Media goes through LiveKit. A room is joined with a short-lived token that
--    the server mints only for a participant whose status is 'joined'
--    (src/app/api/calls/[callId]/token/route.ts).
--  * Busy / Do-not-disturb: a callee who is already in an active call, or who
--    chose "Do not disturb", is not rung; the call is recorded as missed.
--  * Ringing gives up after RING_TIMEOUT (45s) even if the caller vanished.
--  * State changes are broadcast (content-free) to each participant's private
--    inbox topic user:<id>:inbox as event 'call'.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Direct writes off: the RPCs are the only way to change call state.
-- -----------------------------------------------------------------------------
revoke insert, update, delete on public.calls from authenticated;
revoke insert, update, delete on public.call_participants from authenticated;
drop policy calls_insert_initiator on public.calls;
drop policy calls_update_participants on public.calls;
drop policy call_participants_insert_host_or_self on public.call_participants;
drop policy call_participants_update_self on public.call_participants;

-- Conversation members can see a huddle that is in progress (to join it).
create policy calls_select_live_huddle on public.calls
  for select to authenticated
  using (conversation_id is not null and status = 'active' and public.is_conversation_member(conversation_id));

-- ...and who is in it.
create policy call_participants_select_live_huddle on public.call_participants
  for select to authenticated
  using (exists (
    select 1 from public.calls c
    where c.id = call_id and c.conversation_id is not null and c.status = 'active'
      and public.is_conversation_member(c.conversation_id)
  ));

create index call_participants_call_idx on public.call_participants (call_id);
create index calls_status_idx on public.calls (status) where status in ('ringing', 'active');

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
-- Calls older than this are not considered "active" for busy checks, in case a
-- client vanished and no webhook ended the call.
create or replace function public.call_is_live(c public.calls)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case c.status
    when 'ringing' then c.created_at > now() - interval '45 seconds'
    when 'active' then c.created_at > now() - interval '12 hours'
    else false
  end;
$$;

create or replace function public.user_in_live_call(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.call_participants cp
    join public.calls c on c.id = cp.call_id
    where cp.user_id = p_user and cp.status = 'joined' and public.call_is_live(c)
  );
$$;

-- Full state of a call for clients (sent in broadcasts and returned by RPCs).
create or replace function public.call_payload(p_call_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'org_id', c.org_id,
    'kind', c.kind,
    'status', c.status,
    'initiated_by', c.initiated_by,
    'conversation_id', c.conversation_id,
    'livekit_room', c.livekit_room,
    'answered_at', c.answered_at,
    'ended_at', c.ended_at,
    'end_reason', c.end_reason,
    'created_at', c.created_at,
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', cp.user_id, 'status', cp.status) order by cp.created_at)
      from public.call_participants cp where cp.call_id = c.id
    ), '[]'::jsonb)
  )
  from public.calls c
  where c.id = p_call_id;
$$;

-- Send the call state to everyone involved (participants, and for a huddle
-- every conversation member so the "Join huddle" banner stays current).
create or replace function public.broadcast_call(p_call_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := public.call_payload(p_call_id);
  v_user uuid;
begin
  if v_payload is null then return; end if;
  for v_user in
    select cp.user_id from public.call_participants cp where cp.call_id = p_call_id
    union
    select cm.user_id from public.conversation_members cm
    where cm.conversation_id = (v_payload ->> 'conversation_id')::uuid
  loop
    perform public.realtime_broadcast('user:' || v_user || ':inbox', 'call', v_payload);
  end loop;
end;
$$;

create or replace function public.calls_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.broadcast_call(coalesce(new.id, old.id));
  return null;
end;
$$;

create or replace function public.call_participants_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.broadcast_call(coalesce(new.call_id, old.call_id));
  return null;
end;
$$;

-- Deferred to commit: one RPC changes both tables; clients get the final state.
create constraint trigger calls_broadcast
  after insert or update on public.calls
  deferrable initially deferred
  for each row execute function public.calls_after_change();

create constraint trigger call_participants_broadcast
  after insert or update on public.call_participants
  deferrable initially deferred
  for each row execute function public.call_participants_after_change();

-- Ends a call and settles everyone's status.
create or replace function public.finish_call(p_call_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.calls c
     set status = (case when c.answered_at is null then 'missed' else 'ended' end)::public.call_status,
         ended_at = now(),
         end_reason = left(p_reason, 200)
   where c.id = p_call_id and c.status in ('ringing', 'active');
  update public.call_participants cp
     set status = (case when cp.status = 'joined' then 'left' else 'missed' end)::public.call_participant_status,
         left_at = case when cp.status = 'joined' then now() else cp.left_at end
   where cp.call_id = p_call_id and cp.status in ('joined', 'ringing', 'invited');
end;
$$;

-- Ringing calls whose caller disappeared become missed (cheap: only this pair).
create or replace function public.expire_stale_ringing(p_users uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_call uuid;
begin
  for v_call in
    select distinct c.id from public.calls c
    join public.call_participants cp on cp.call_id = c.id
    where c.status = 'ringing' and c.created_at <= now() - interval '45 seconds' and cp.user_id = any (p_users)
  loop
    perform public.finish_call(v_call, 'no_answer');
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: start_call — ring one person (1:1 audio or video)
-- Returns the call payload; status is 'ringing', or 'missed' with end_reason
-- 'busy' / 'dnd' when the callee can't be rung right now.
-- -----------------------------------------------------------------------------
create or replace function public.start_call(p_org_id uuid, p_callee uuid, p_kind public.call_kind)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_call uuid;
  v_unavailable text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_callee is null or p_callee = v_uid then
    raise exception 'choose someone else to call' using errcode = '22023';
  end if;
  if not public.is_org_member(p_org_id)
     or not exists (select 1 from public.memberships m where m.org_id = p_org_id and m.user_id = p_callee) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;

  perform public.expire_stale_ringing(array[v_uid, p_callee]);

  -- Already ringing/connected between these two: reuse that call.
  select c.id into v_call
  from public.calls c
  where c.org_id = p_org_id and c.conversation_id is null and c.meeting_id is null
    and public.call_is_live(c)
    and exists (select 1 from public.call_participants a where a.call_id = c.id and a.user_id = v_uid)
    and exists (select 1 from public.call_participants b where b.call_id = c.id and b.user_id = p_callee)
  order by c.created_at desc
  limit 1;
  if v_call is not null then
    return public.call_payload(v_call);
  end if;

  if public.user_in_live_call(p_callee) then
    v_unavailable := 'busy';
  elsif (select p.availability from public.profiles p where p.id = p_callee) = 'dnd' then
    v_unavailable := 'dnd';
  end if;

  insert into public.calls (org_id, initiated_by, kind, status)
  values (p_org_id, v_uid, p_kind, 'ringing')
  returning id into v_call;
  update public.calls set livekit_room = 'call_' || v_call where id = v_call;

  insert into public.call_participants (org_id, call_id, user_id, status, joined_at)
  values
    (p_org_id, v_call, v_uid, 'joined', now()),
    (p_org_id, v_call, p_callee, 'ringing', null);

  if v_unavailable is not null then
    perform public.finish_call(v_call, v_unavailable);
  end if;

  return public.call_payload(v_call);
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: start_huddle — start (or join the running) group call of a conversation.
-- Members are not rung; they see "Huddle in progress — Join".
-- -----------------------------------------------------------------------------
create or replace function public.start_huddle(p_conversation_id uuid, p_kind public.call_kind)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_call uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.is_conversation_member(p_conversation_id) then
    raise exception 'not a member of this conversation' using errcode = '42501';
  end if;
  select c.org_id into v_org from public.conversations c where c.id = p_conversation_id;

  select c.id into v_call from public.calls c
  where c.conversation_id = p_conversation_id and public.call_is_live(c)
  order by c.created_at desc limit 1;

  if v_call is null then
    insert into public.calls (org_id, initiated_by, conversation_id, kind, status, answered_at)
    values (v_org, v_uid, p_conversation_id, p_kind, 'active', now())
    returning id into v_call;
    update public.calls set livekit_room = 'call_' || v_call where id = v_call;
  end if;

  insert into public.call_participants (org_id, call_id, user_id, status, joined_at)
  values (v_org, v_call, v_uid, 'joined', now())
  on conflict (call_id, user_id) do update set status = 'joined', joined_at = now(), left_at = null;

  return public.call_payload(v_call);
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs: answer / decline / leave
-- -----------------------------------------------------------------------------
create or replace function public.answer_call(p_call_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_call public.calls;
begin
  select * into v_call from public.calls where id = p_call_id for update;
  if v_call.id is null or not exists (
    select 1 from public.call_participants cp where cp.call_id = p_call_id and cp.user_id = v_uid and cp.status = 'ringing'
  ) then
    raise exception 'there is no ringing call to answer' using errcode = '42501';
  end if;
  if not public.call_is_live(v_call) then
    perform public.finish_call(p_call_id, 'no_answer');
    raise exception 'the call has ended' using errcode = '22023';
  end if;

  update public.call_participants set status = 'joined', joined_at = now(), left_at = null
   where call_id = p_call_id and user_id = v_uid;
  update public.calls set status = 'active', answered_at = coalesce(answered_at, now())
   where id = p_call_id;
  return public.call_payload(p_call_id);
end;
$$;

create or replace function public.decline_call(p_call_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.call_participants set status = 'declined'
   where call_id = p_call_id and user_id = v_uid and status = 'ringing';
  if not found then
    raise exception 'there is no ringing call to decline' using errcode = '42501';
  end if;
  -- A 1:1 call ends when the only callee declines.
  if not exists (
    select 1 from public.call_participants cp
    where cp.call_id = p_call_id and cp.user_id <> v_uid and cp.status in ('ringing', 'invited')
  ) and exists (select 1 from public.calls c where c.id = p_call_id and c.conversation_id is null) then
    update public.calls set status = 'declined', ended_at = now(), end_reason = 'declined'
     where id = p_call_id and status = 'ringing';
  end if;
  return public.call_payload(p_call_id);
end;
$$;

-- Leaving, hanging up and cancelling. A 1:1 call ends when either side leaves;
-- a huddle ends when the last person leaves. p_reason: 'hangup' (default),
-- 'no_answer' (caller's ring timeout), 'cancelled'.
create or replace function public.leave_call(p_call_id uuid, p_reason text default 'hangup')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_call public.calls;
begin
  select * into v_call from public.calls where id = p_call_id for update;
  if v_call.id is null or not exists (
    select 1 from public.call_participants cp where cp.call_id = p_call_id and cp.user_id = v_uid
  ) then
    raise exception 'not a participant of this call' using errcode = '42501';
  end if;
  if p_reason not in ('hangup', 'no_answer', 'cancelled') then
    p_reason := 'hangup';
  end if;

  update public.call_participants set status = 'left', left_at = now()
   where call_id = p_call_id and user_id = v_uid and status = 'joined';

  if v_call.conversation_id is null
     or not exists (select 1 from public.call_participants cp where cp.call_id = p_call_id and cp.status = 'joined') then
    perform public.finish_call(p_call_id, p_reason);
  end if;
  return public.call_payload(p_call_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: my_calls — live calls involving me (incoming ringing, ongoing) and
-- live huddles in my conversations. Used after (re)connecting.
-- -----------------------------------------------------------------------------
create or replace function public.my_live_calls()
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.call_payload(c.id)
  from public.calls c
  where public.call_is_live(c)
    and (
      exists (select 1 from public.call_participants cp where cp.call_id = c.id and cp.user_id = auth.uid())
      or (c.conversation_id is not null and public.is_conversation_member(c.conversation_id))
    )
  order by c.created_at desc
  limit 20;
$$;

-- -----------------------------------------------------------------------------
-- Webhook (service role only): LiveKit tells us who left / when a room closed.
-- -----------------------------------------------------------------------------
create or replace function public.livekit_participant_left(p_room text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_call public.calls;
begin
  select * into v_call from public.calls where livekit_room = p_room;
  if v_call.id is null then return; end if;
  update public.call_participants set status = 'left', left_at = now()
   where call_id = v_call.id and user_id = p_user and status = 'joined';
  if v_call.conversation_id is null
     or not exists (select 1 from public.call_participants cp where cp.call_id = v_call.id and cp.status = 'joined') then
    perform public.finish_call(v_call.id, 'disconnected');
  end if;
end;
$$;

create or replace function public.livekit_room_finished(p_room text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.calls where livekit_room = p_room;
  if v_id is not null then
    perform public.finish_call(v_id, 'room_closed');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Function privileges (Supabase grants EXECUTE to client roles by default)
-- -----------------------------------------------------------------------------
revoke execute on function
  public.call_is_live(public.calls),
  public.user_in_live_call(uuid),
  public.call_payload(uuid),
  public.broadcast_call(uuid),
  public.calls_after_change(),
  public.call_participants_after_change(),
  public.finish_call(uuid, text),
  public.expire_stale_ringing(uuid[]),
  public.start_call(uuid, uuid, public.call_kind),
  public.start_huddle(uuid, public.call_kind),
  public.answer_call(uuid),
  public.decline_call(uuid),
  public.leave_call(uuid, text),
  public.my_live_calls(),
  public.livekit_participant_left(text, uuid),
  public.livekit_room_finished(text)
from public, anon, authenticated;

grant execute on function
  public.start_call(uuid, uuid, public.call_kind),
  public.start_huddle(uuid, public.call_kind),
  public.answer_call(uuid),
  public.decline_call(uuid),
  public.leave_call(uuid, text),
  public.my_live_calls()
to authenticated, service_role;

grant execute on function
  public.livekit_participant_left(text, uuid),
  public.livekit_room_finished(text)
to service_role;
