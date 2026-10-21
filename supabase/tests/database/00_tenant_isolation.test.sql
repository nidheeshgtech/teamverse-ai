-- RLS: (a) tenant isolation and (h) anon sees nothing.
-- Relies on supabase/seed.sql (demo org d0000000-0000-4000-8000-000000000001).
begin;
create extension if not exists pgtap with schema extensions;

select plan(45);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres): a second org with its own owner, plus demo-org rows
-- in every table that the seed leaves empty, so "0 rows" is meaningful.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000001',
        'authenticated', 'authenticated', 'owner@other-org.test',
        '{"provider":"email","providers":["email"]}', '{"display_name":"Other Owner"}', now(), now());

insert into public.organizations (id, name, slug)
values ('d1000000-0000-4000-8000-000000000002', 'Other Org', 'other-org');
insert into public.memberships (org_id, user_id, role)
values ('d1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'owner');

insert into public.org_invitations (org_id, email, role, token_hash, invited_by)
values ('d0000000-0000-4000-8000-000000000001', 'pending@demo.teamverse.local', 'member',
        encode(sha256(convert_to('fixture-token-0000000000000000', 'UTF8')), 'hex'),
        'a0000000-0000-4000-8000-000000000001');

insert into public.meetings (id, org_id, host_id, title)
values ('ab000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002', 'Sprint review');
insert into public.meeting_invites (org_id, meeting_id, user_id)
values ('d0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000003');

insert into public.calls (id, org_id, initiated_by, conversation_id, kind)
values ('ac000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'audio');
insert into public.call_participants (org_id, call_id, user_id)
values ('d0000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000004');

insert into public.message_attachments (org_id, conversation_id, message_id, uploader_id, storage_path, file_name, mime_type, size_bytes)
values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
        'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
        'd0000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000001/spec.pdf',
        'spec.pdf', 'application/pdf', 1024);

insert into public.notifications (org_id, user_id, kind)
values ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'message');

insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values ('a0000000-0000-4000-8000-000000000004', 'https://push.example.test/sub/1', 'p256dh-key', 'auth-key');

insert into public.ai_jobs (org_id, kind, conversation_id, requested_by)
values ('d0000000-0000-4000-8000-000000000001', 'summary', 'c0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002');

insert into public.audit_events (org_id, actor_id, action)
values ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'fixture.event');

-- ---------------------------------------------------------------------------
-- (a) Owner of another org sees no demo-org rows in any table
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","email":"owner@other-org.test","role":"authenticated"}';

select is((select count(*) from public.organizations where id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: organizations');
select is((select count(*) from public.profiles where id <> 'b0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: profiles of demo users');
select is((select count(*) from public.departments where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: departments');
select is((select count(*) from public.memberships where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: memberships');
select is((select count(*) from public.office_layouts where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: office_layouts');
select is((select count(*) from public.office_seats where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: office_seats');
select is((select count(*) from public.org_invitations where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: org_invitations');
select is((select count(*) from public.conversations where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: conversations');
select is((select count(*) from public.conversation_members where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: conversation_members');
select is((select count(*) from public.messages where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: messages');
select is((select count(*) from public.message_attachments where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: message_attachments');
select is((select count(*) from public.message_receipts where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: message_receipts');
select is((select count(*) from public.meetings where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: meetings');
select is((select count(*) from public.meeting_invites where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: meeting_invites');
select is((select count(*) from public.calls where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: calls');
select is((select count(*) from public.call_participants where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: call_participants');
select is((select count(*) from public.notifications where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: notifications');
select is((select count(*) from public.push_subscriptions), 0::bigint, 'other org: push_subscriptions');
select is((select count(*) from public.ai_jobs where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: ai_jobs');
select is((select count(*) from public.audit_events where org_id = 'd0000000-0000-4000-8000-000000000001'), 0::bigint, 'other org: audit_events');

select is((select count(*) from public.organizations), 1::bigint, 'other org owner still sees their own org');

select throws_ok(
  $$ insert into public.departments (org_id, name, slug, color_token)
     values ('d0000000-0000-4000-8000-000000000001', 'Intrusion', 'intrusion', 'dept-intrusion') $$,
  '42501', null, 'other org owner cannot write demo departments');

select throws_ok(
  $$ select public.create_conversation('d0000000-0000-4000-8000-000000000001', 'direct',
       array['a0000000-0000-4000-8000-000000000004']::uuid[]) $$,
  '42501', null, 'other org owner cannot create a conversation in the demo org');

reset role;

-- ---------------------------------------------------------------------------
-- (h) anon sees nothing
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok('select * from public.organizations',        '42501', null, 'anon: organizations');
select throws_ok('select * from public.profiles',             '42501', null, 'anon: profiles');
select throws_ok('select * from public.departments',          '42501', null, 'anon: departments');
select throws_ok('select * from public.memberships',          '42501', null, 'anon: memberships');
select throws_ok('select * from public.office_layouts',       '42501', null, 'anon: office_layouts');
select throws_ok('select * from public.office_seats',         '42501', null, 'anon: office_seats');
select throws_ok('select * from public.org_invitations',      '42501', null, 'anon: org_invitations');
select throws_ok('select * from public.conversations',        '42501', null, 'anon: conversations');
select throws_ok('select * from public.conversation_members', '42501', null, 'anon: conversation_members');
select throws_ok('select * from public.messages',             '42501', null, 'anon: messages');
select throws_ok('select * from public.message_attachments',  '42501', null, 'anon: message_attachments');
select throws_ok('select * from public.message_receipts',     '42501', null, 'anon: message_receipts');
select throws_ok('select * from public.meetings',             '42501', null, 'anon: meetings');
select throws_ok('select * from public.meeting_invites',      '42501', null, 'anon: meeting_invites');
select throws_ok('select * from public.calls',                '42501', null, 'anon: calls');
select throws_ok('select * from public.call_participants',    '42501', null, 'anon: call_participants');
select throws_ok('select * from public.notifications',        '42501', null, 'anon: notifications');
select throws_ok('select * from public.push_subscriptions',   '42501', null, 'anon: push_subscriptions');
select throws_ok('select * from public.ai_jobs',              '42501', null, 'anon: ai_jobs');
select throws_ok('select * from public.audit_events',         '42501', null, 'anon: audit_events');

select throws_ok(
  $$ select public.is_org_member('d0000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'anon cannot call membership helpers');

select is_empty(
  $$ select * from public.invitation_preview('not-a-real-token-0000000000') $$,
  'anon invitation_preview returns nothing for an unknown token');

reset role;

select * from finish();
rollback;
