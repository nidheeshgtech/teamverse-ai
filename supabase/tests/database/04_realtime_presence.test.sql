-- Office presence channel authorization (migration 20261021000004).
-- Realtime evaluates these policies with realtime.topic() = the channel being joined.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into realtime.messages (topic, extension, payload, event, private)
values ('org:d0000000-0000-4000-8000-000000000001:presence', 'presence', '{}', 'presence', true);

-- Member of the demo org
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('realtime.topic', 'org:d0000000-0000-4000-8000-000000000001:presence', true);
set local role authenticated;

select ok((select count(*) from realtime.messages where extension = 'presence') >= 1, 'member can receive org presence');
select lives_ok(
  $$ insert into realtime.messages (topic, extension, payload, event, private)
     values ('org:d0000000-0000-4000-8000-000000000001:presence', 'presence', '{}', 'presence', true) $$,
  'member can track presence');
select throws_ok(
  $$ insert into realtime.messages (topic, extension, payload, event, private)
     values ('org:d0000000-0000-4000-8000-000000000001:presence', 'broadcast', '{}', 'x', true) $$,
  '42501', null, 'presence policy does not allow broadcast writes');

-- Another org's channel
select set_config('realtime.topic', 'org:e0000000-0000-4000-8000-000000000123:presence', true);
select throws_ok(
  $$ insert into realtime.messages (topic, extension, payload, event, private)
     values ('org:e0000000-0000-4000-8000-000000000123:presence', 'presence', '{}', 'presence', true) $$,
  '42501', null, 'member cannot join another organization''s channel');

-- Non-member
reset role;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000099","role":"authenticated"}', true);
select set_config('realtime.topic', 'org:d0000000-0000-4000-8000-000000000001:presence', true);
set local role authenticated;
select is((select count(*) from realtime.messages)::int, 0, 'non-member receives nothing');

-- Malformed topic
select set_config('realtime.topic', 'org:not-a-uuid:presence', true);
select is((select count(*) from realtime.messages)::int, 0, 'malformed topic fails closed');

select * from finish();
rollback;
