-- Phase 4 calls (migration 20261023000001): RPC state machine, busy/DND,
-- privacy, and the ban on direct writes.
-- Seed: Zayd a...04, Noor a...05, Layla a...06, Tariq a...02 (admin);
-- c...01 eng-architecture (Zayd member, Noor not).
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- ---------------------------------------------------------------------------
-- Zayd calls Layla
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';

create temporary table _c on commit drop as
  select (public.start_call('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'video') ->> 'id')::uuid as id;
grant select on _c to authenticated;

select is((select status::text from public.calls where id = (select id from _c)), 'ringing', 'start_call rings the callee');
select is((select livekit_room from public.calls where id = (select id from _c)), 'call_' || (select id from _c), 'call gets a LiveKit room name');
select is((select status::text from public.call_participants where call_id = (select id from _c) and user_id = 'a0000000-0000-4000-8000-000000000006'), 'ringing',
  'callee is ringing');
select is((public.start_call('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'video') ->> 'id')::uuid, (select id from _c),
  'calling again while ringing reuses the call');
select throws_ok($$ select public.start_call('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'audio') $$,
  '22023', null, 'cannot call yourself');
select throws_ok($$ insert into public.calls (org_id, initiated_by, kind) values ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'audio') $$,
  '42501', null, 'direct inserts into calls are not allowed');
select throws_ok($$ update public.call_participants set status = 'joined' where user_id = 'a0000000-0000-4000-8000-000000000006' $$,
  '42501', null, 'direct status changes are not allowed');
select throws_ok($$ select public.answer_call((select id from _c)) $$, '42501', null, 'the caller cannot answer for the callee');

-- Tariq (admin, not part of the call) sees nothing.
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is_empty($$ select 1 from public.calls where id = (select id from _c) $$, 'admins cannot see other people''s calls');
select throws_ok($$ select public.leave_call((select id from _c)) $$, '42501', null, 'outsiders cannot end a call');

-- Layla answers.
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000006","role":"authenticated"}';
select lives_ok($$ select public.answer_call((select id from _c)) $$, 'callee can answer');
select is((select status::text from public.calls where id = (select id from _c)), 'active', 'answered call is active');
select ok((select answered_at is not null from public.calls where id = (select id from _c)), 'answered_at is set');

-- Noor tries to call Layla, who is now in a call: busy.
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';
select is(public.start_call('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'audio') ->> 'end_reason', 'busy',
  'a callee already in a call is busy');

-- Layla hangs up: a 1:1 call ends for both.
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000006","role":"authenticated"}';
select lives_ok($$ select public.leave_call((select id from _c)) $$, 'participant can hang up');
select is((select status::text from public.calls where id = (select id from _c)), 'ended', '1:1 call ends when one side leaves');
select is((select count(*)::int from public.call_participants where call_id = (select id from _c) and status = 'joined'), 0, 'nobody is left joined');

-- DND: Layla chooses Do not disturb; Noor's call is not rung.
reset role;
update public.profiles set availability = 'dnd' where id = 'a0000000-0000-4000-8000-000000000006';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';
select is(public.start_call('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'audio') ->> 'end_reason', 'dnd',
  'a callee in Do not disturb is not rung');

-- ---------------------------------------------------------------------------
-- Huddles
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
create temporary table _h on commit drop as
  select (public.start_huddle('c0000000-0000-4000-8000-000000000001', 'audio') ->> 'id')::uuid as id;
grant select on _h to authenticated;
select is((select status::text from public.calls where id = (select id from _h)), 'active', 'a huddle starts active (no ringing)');

-- Tariq is a member of eng-architecture: he can see and join it.
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((public.start_huddle('c0000000-0000-4000-8000-000000000001', 'audio') ->> 'id')::uuid, (select id from _h), 'members join the running huddle');

-- Noor is not a member.
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok($$ select public.start_huddle('c0000000-0000-4000-8000-000000000001', 'audio') $$, '42501', null, 'non-members cannot join a huddle');

-- Only the RPCs are executable; webhook helpers are service-role only.
select throws_ok($$ select public.livekit_room_finished('call_x') $$, '42501', null, 'clients cannot call webhook helpers');

select * from finish();
rollback;
