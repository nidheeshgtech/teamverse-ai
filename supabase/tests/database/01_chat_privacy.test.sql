-- RLS: (b) admins cannot read DMs they are not in; (c) message insert/update rules.
-- Seed: DM c...02 is between Zayd (a...04) and Layla (a...06). Tariq (a...02)
-- is an org admin and Demo Admin (a...01) is the owner; neither is in the DM.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- Fixtures: a DM attachment row and its storage object.
-- Storage object first: attachment rows must point at a stored object (Phase 3 trigger).
insert into storage.objects (bucket_id, name, owner)
values ('attachments',
        'd0000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000002/screens.png',
        'a0000000-0000-4000-8000-000000000004');
insert into public.message_attachments (org_id, conversation_id, message_id, uploader_id, storage_path, file_name, mime_type, size_bytes)
values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
        'e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000004',
        'd0000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000002/screens.png',
        'screens.png', 'image/png', 2048);

-- ---------------------------------------------------------------------------
-- (b) Org admin, not a DM member
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","email":"tariq.mansour@demo.teamverse.local","role":"authenticated"}';

select is_empty($$ select 1 from public.messages where conversation_id = 'c0000000-0000-4000-8000-000000000002' $$,
  'admin cannot read DM messages');
select is_empty($$ select 1 from public.conversations where id = 'c0000000-0000-4000-8000-000000000002' $$,
  'admin cannot see the DM conversation row');
select is_empty($$ select 1 from public.conversation_members where conversation_id = 'c0000000-0000-4000-8000-000000000002' $$,
  'admin cannot see DM membership');
select is_empty($$ select 1 from public.message_receipts where conversation_id = 'c0000000-0000-4000-8000-000000000002' $$,
  'admin cannot see DM read receipts');
select is_empty($$ select 1 from public.message_attachments where conversation_id = 'c0000000-0000-4000-8000-000000000002' $$,
  'admin cannot see DM attachments');
select is_empty($$ select 1 from storage.objects where bucket_id = 'attachments' $$,
  'admin cannot read DM attachment objects in storage');

-- Owner (highest role) gets no bypass either.
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","email":"admin@demo.teamverse.local","role":"authenticated"}';
select is((select count(*) from public.messages), 0::bigint, 'owner who is in no conversation sees no messages at all');

-- Positive control: a DM member sees the DM.
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000006","email":"layla.nour@demo.teamverse.local","role":"authenticated"}';
select is((select count(*) from public.messages where conversation_id = 'c0000000-0000-4000-8000-000000000002'), 3::bigint,
  'DM member sees the DM messages');

-- ---------------------------------------------------------------------------
-- (c) Message insert / update rules
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","email":"zayd.benali@demo.teamverse.local","role":"authenticated"}';

select throws_ok(
  $$ insert into public.messages (org_id, conversation_id, sender_id, body)
     values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
             'a0000000-0000-4000-8000-000000000006', 'spoofed') $$,
  '42501', null, 'member cannot insert a message as someone else');

select throws_ok(
  $$ insert into public.messages (org_id, conversation_id, sender_id, body, kind)
     values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
             'a0000000-0000-4000-8000-000000000004', 'fake system', 'system') $$,
  '42501', null, 'member cannot insert system messages');

select throws_ok(
  $$ insert into public.message_receipts (org_id, conversation_id, message_id, user_id, read_at)
     values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
             'e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000006', now()) $$,
  '42501', null, 'member cannot write a read receipt for someone else');

select lives_ok(
  $$ insert into public.messages (org_id, conversation_id, sender_id, body)
     values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
             'a0000000-0000-4000-8000-000000000004', 'legit') $$,
  'member can insert as themselves into their own conversation');

-- Noor (a...05) is an org member but not in the DM.
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","email":"noor.khalid@demo.teamverse.local","role":"authenticated"}';
select throws_ok(
  $$ insert into public.messages (org_id, conversation_id, sender_id, body)
     values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
             'a0000000-0000-4000-8000-000000000005', 'intrusion') $$,
  '42501', null, 'member cannot insert into a conversation they are not in');

-- Layla cannot edit/delete Zayd's message, nor reassign her own.
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000006","email":"layla.nour@demo.teamverse.local","role":"authenticated"}';
select is_empty(
  $$ update public.messages set body = 'tampered' where id = 'e0000000-0000-4000-8000-000000000005' returning id $$,
  'member cannot edit someone else''s message');
select is_empty(
  $$ delete from public.messages where id = 'e0000000-0000-4000-8000-000000000005' returning id $$,
  'member cannot delete someone else''s message');
select throws_ok(
  $$ update public.messages set sender_id = 'a0000000-0000-4000-8000-000000000004'
     where id = 'e0000000-0000-4000-8000-000000000006' $$,
  '42501', null, 'member cannot change sender_id of their own message');

reset role;
select is((select body from public.messages where id = 'e0000000-0000-4000-8000-000000000005'),
  'Hi Layla, do you have the updated onboarding screens?', 'original message is untouched');

select * from finish();
rollback;
