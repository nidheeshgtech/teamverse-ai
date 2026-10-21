-- Phase 3 messaging (migration 20261022000001): channels, send_message,
-- read receipts privacy, soft delete, and Realtime topic authorization.
-- Seed: Zayd a...04, Noor a...05, Layla a...06 (opted out of read receipts).
--   c...01 eng-architecture (private; Zayd is a member, Noor is not)
--   c...02 DM Zayd <-> Layla
--   c...03 general-announcements (public; everyone but the owner)
--   c...04 design-critique (public; Zayd and Noor are not members)
--   c...05 client-showcase (private; Noor is a member, Zayd is not)
begin;
create extension if not exists pgtap with schema extensions;

select plan(38);

insert into realtime.messages (topic, extension, payload, event, private)
values ('conversation:c0000000-0000-4000-8000-000000000001', 'broadcast', '{}', 'message_created', true);

select ok((select relrowsecurity from pg_class where oid = 'realtime.messages'::regclass),
  'RLS is enabled on realtime.messages');
select isnt(
  (select last_read_at from public.conversation_members
    where conversation_id = 'c0000000-0000-4000-8000-000000000002' and user_id = 'a0000000-0000-4000-8000-000000000006'),
  null, 'precondition: Layla has a read position');

-- ---------------------------------------------------------------------------
-- Channels: browse, join, privacy
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';

select isnt_empty($$ select 1 from public.conversations where id = 'c0000000-0000-4000-8000-000000000004' $$,
  'org member sees a public channel they have not joined');
select is_empty($$ select 1 from public.messages where conversation_id = 'c0000000-0000-4000-8000-000000000004' $$,
  'but cannot read its messages before joining');
select is_empty($$ select 1 from public.conversations where id = 'c0000000-0000-4000-8000-000000000005' $$,
  'private channel is invisible to non-members');
select is((select count(*)::int from public.browse_channels('d0000000-0000-4000-8000-000000000001')), 2,
  'browse_channels lists the two public channels');
select throws_ok(
  $$ select public.join_channel('c0000000-0000-4000-8000-000000000005') $$,
  '42501', null, 'cannot join a private channel');
select lives_ok(
  $$ select public.join_channel('c0000000-0000-4000-8000-000000000004') $$,
  'can join a public channel');
select is((select count(*)::int from public.messages where conversation_id = 'c0000000-0000-4000-8000-000000000004'), 2,
  'after joining, channel history is readable');
select is(
  (select unread_count from public.list_conversations('d0000000-0000-4000-8000-000000000001')
    where id = 'c0000000-0000-4000-8000-000000000004'),
  0, 'joining starts with nothing unread');
select throws_ok(
  $$ select public.create_conversation('d0000000-0000-4000-8000-000000000001', 'group',
       array['a0000000-0000-4000-8000-000000000005']::uuid[], 'x', null, 'public') $$,
  '22023', null, 'only channels can be public');

-- ---------------------------------------------------------------------------
-- Unread counts
-- ---------------------------------------------------------------------------
select is(
  (select unread_count from public.list_conversations('d0000000-0000-4000-8000-000000000001')
    where id = 'c0000000-0000-4000-8000-000000000001'),
  3, 'unread counts messages from others since last read');
select is(
  (select unread_count from public.list_conversations('d0000000-0000-4000-8000-000000000001')
    where id = 'c0000000-0000-4000-8000-000000000007'),
  0, 'own messages are never unread');

-- ---------------------------------------------------------------------------
-- send_message
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.send_message('c0000000-0000-4000-8000-000000000002', 'hello', '11111111-1111-4111-8111-111111111111') $$,
  'member can send');
select lives_ok(
  $$ select public.send_message('c0000000-0000-4000-8000-000000000002', 'hello', '11111111-1111-4111-8111-111111111111') $$,
  'retry with the same client_id succeeds');
select is((select count(*)::int from public.messages where client_id = '11111111-1111-4111-8111-111111111111'), 1,
  'retry does not duplicate the message');
select throws_ok(
  $$ select public.send_message('c0000000-0000-4000-8000-000000000007', 'hello', '11111111-1111-4111-8111-111111111111') $$,
  '22023', null, 'a client_id cannot be reused in another conversation');
select throws_ok(
  $$ select public.send_message('c0000000-0000-4000-8000-000000000005', 'intrusion', gen_random_uuid()) $$,
  '42501', null, 'cannot send to a conversation you are not in');
select throws_ok(
  $$ select public.send_message('c0000000-0000-4000-8000-000000000002', '   ', gen_random_uuid()) $$,
  '22023', null, 'empty message is rejected');
select throws_ok(
  $$ select public.send_message('c0000000-0000-4000-8000-000000000002', 'x', gen_random_uuid(), null,
       '[{"storage_path":"d0000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000005/a.png","file_name":"a.png"}]') $$,
  '42501', null, 'attachment path must belong to this conversation');
select throws_ok(
  $$ select public.send_message('c0000000-0000-4000-8000-000000000002', 'x', gen_random_uuid(), null,
       '[{"storage_path":"d0000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000002/missing.png","file_name":"missing.png"}]') $$,
  '42501', null, 'attachment must be an object the sender uploaded');

-- ---------------------------------------------------------------------------
-- Read receipts privacy
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select last_read_at from public.conversation_members $$,
  '42501', null, 'private read position of members is not selectable');
select is(
  (select shared_read_at from public.conversation_members
    where conversation_id = 'c0000000-0000-4000-8000-000000000002' and user_id = 'a0000000-0000-4000-8000-000000000006'),
  null, 'opted-out member shares no read position');
select is_empty($$ select 1 from public.message_receipts where user_id <> 'a0000000-0000-4000-8000-000000000004' $$,
  'per-message receipts of others are hidden');

update public.conversation_members set last_read_at = now() - interval '5 minutes'
 where conversation_id = 'c0000000-0000-4000-8000-000000000002' and user_id = 'a0000000-0000-4000-8000-000000000004';
update public.conversation_members set last_read_at = now() - interval '10 days'
 where conversation_id = 'c0000000-0000-4000-8000-000000000002' and user_id = 'a0000000-0000-4000-8000-000000000004';
select is(
  (select shared_read_at from public.conversation_members
    where conversation_id = 'c0000000-0000-4000-8000-000000000002' and user_id = 'a0000000-0000-4000-8000-000000000004'),
  now() - interval '5 minutes',
  'read position never moves backwards');
update public.conversation_members set last_read_at = now() + interval '10 days'
 where conversation_id = 'c0000000-0000-4000-8000-000000000002' and user_id = 'a0000000-0000-4000-8000-000000000004';
select ok(
  (select shared_read_at from public.conversation_members
    where conversation_id = 'c0000000-0000-4000-8000-000000000002' and user_id = 'a0000000-0000-4000-8000-000000000004')
  <= now(),
  'read position cannot be set in the future');

-- ---------------------------------------------------------------------------
-- Leaving and deleting
-- ---------------------------------------------------------------------------
select is_empty(
  $$ delete from public.conversation_members
      where conversation_id = 'c0000000-0000-4000-8000-000000000002' and user_id = 'a0000000-0000-4000-8000-000000000004'
      returning id $$,
  'cannot leave a DM');
select is_empty(
  $$ delete from public.messages where id = 'e0000000-0000-4000-8000-000000000005' returning id $$,
  'cannot hard-delete own message');
update public.messages set deleted_at = now() where id = 'e0000000-0000-4000-8000-000000000005';
select is((select body from public.messages where id = 'e0000000-0000-4000-8000-000000000005'), '',
  'soft delete wipes the text');
-- The object exists, so only the "message is deleted" rule can reject the row.
insert into storage.objects (bucket_id, name, owner)
values ('attachments', 'd0000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000002/late.png',
        'a0000000-0000-4000-8000-000000000004');
select throws_ok(
  $$ insert into public.message_attachments (org_id, conversation_id, message_id, uploader_id, storage_path, file_name, mime_type, size_bytes)
     values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
             'e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000004',
             'd0000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000002/late.png', 'late.png', 'image/png', 10) $$,
  '42501', null, 'cannot attach files to a deleted message');
select throws_ok(
  $$ select public.realtime_broadcast('conversation:c0000000-0000-4000-8000-000000000005', 'message_created', '{}') $$,
  '42501', null, 'clients cannot call the internal broadcast helper');

-- Fire the deferred broadcast trigger now (the test never commits) and check it reached Realtime.
set constraints messages_broadcast_insert immediate;
reset role;
select isnt_empty(
  $$ select 1 from realtime.messages
     where topic = 'conversation:c0000000-0000-4000-8000-000000000002' and event = 'message_created'
       and payload ->> 'client_id' = '11111111-1111-4111-8111-111111111111' $$,
  'a sent message is broadcast to the conversation topic');
select isnt_empty(
  $$ select 1 from realtime.messages
     where topic = 'user:a0000000-0000-4000-8000-000000000006:inbox' and event = 'message' $$,
  'and pinged to the other member''s inbox');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Realtime topics
-- ---------------------------------------------------------------------------
select set_config('realtime.topic', 'conversation:c0000000-0000-4000-8000-000000000001', true);
select ok((select count(*) from realtime.messages where extension = 'broadcast') >= 1,
  'member receives conversation broadcasts');
select throws_ok(
  $$ insert into realtime.messages (topic, extension, payload, event, private)
     values ('conversation:c0000000-0000-4000-8000-000000000001', 'broadcast', '{}', 'message_created', true) $$,
  '42501', null, 'members cannot forge server events');

select set_config('realtime.topic', 'conversation:c0000000-0000-4000-8000-000000000001:typing', true);
select lives_ok(
  $$ insert into realtime.messages (topic, extension, payload, event, private)
     values ('conversation:c0000000-0000-4000-8000-000000000001:typing', 'broadcast', '{}', 'typing', true) $$,
  'members can send typing events');

select set_config('realtime.topic', 'user:a0000000-0000-4000-8000-000000000006:inbox', true);
select is((select count(*)::int from realtime.messages), 0, 'cannot listen to someone else''s inbox');

-- Noor is not in eng-architecture.
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';
select set_config('realtime.topic', 'conversation:c0000000-0000-4000-8000-000000000001', true);
select is((select count(*)::int from realtime.messages), 0, 'non-member receives no conversation broadcasts');

select * from finish();
rollback;
