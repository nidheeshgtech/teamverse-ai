-- RLS: (f) audit_events is append-only; (g) accept_invitation validation.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

insert into public.audit_events (org_id, actor_id, action)
values ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'fixture.event');

-- ---------------------------------------------------------------------------
-- (f) audit_events
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","email":"admin@demo.teamverse.local","role":"authenticated"}';

select ok((select count(*) from public.audit_events) >= 1, 'owner can read audit events');
select throws_ok($$ update public.audit_events set action = 'rewritten' $$, '42501', null, 'owner cannot update audit events');
select throws_ok($$ delete from public.audit_events $$, '42501', null, 'owner cannot delete audit events');
select throws_ok(
  $$ insert into public.audit_events (org_id, action) values ('d0000000-0000-4000-8000-000000000001', 'forged') $$,
  '42501', null, 'owner cannot insert audit events directly');

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","email":"zayd.benali@demo.teamverse.local","role":"authenticated"}';
select is((select count(*) from public.audit_events), 0::bigint, 'members cannot read audit events');
select throws_ok($$ update public.audit_events set action = 'rewritten' $$, '42501', null, 'member cannot update audit events');

reset role;
select throws_ok($$ update public.audit_events set action = 'rewritten' $$, '42501', 'audit_events is append-only',
  'audit events are immutable even for the table owner');

-- ---------------------------------------------------------------------------
-- (g) accept_invitation
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000003',
        'authenticated', 'authenticated', 'new.hire@demo.teamverse.local',
        '{"provider":"email","providers":["email"]}', '{"display_name":"New Hire"}', now(), now());

insert into public.org_invitations (org_id, email, role, token_hash, invited_by, expires_at, revoked_at) values
  ('d0000000-0000-4000-8000-000000000001', 'new.hire@demo.teamverse.local', 'member',
   encode(sha256(convert_to('valid-token-00000000000000000000', 'UTF8')), 'hex'),
   'a0000000-0000-4000-8000-000000000001', now() + interval '7 days', null),
  ('d0000000-0000-4000-8000-000000000001', 'expired.hire@demo.teamverse.local', 'member',
   encode(sha256(convert_to('expired-token-000000000000000000', 'UTF8')), 'hex'),
   'a0000000-0000-4000-8000-000000000001', now() - interval '1 day', null),
  ('d0000000-0000-4000-8000-000000000001', 'revoked.hire@demo.teamverse.local', 'member',
   encode(sha256(convert_to('revoked-token-000000000000000000', 'UTF8')), 'hex'),
   'a0000000-0000-4000-8000-000000000001', now() + interval '7 days', now()),
  ('d0000000-0000-4000-8000-000000000001', 'someone.else@demo.teamverse.local', 'admin',
   encode(sha256(convert_to('wrongmail-token-0000000000000000', 'UTF8')), 'hex'),
   'a0000000-0000-4000-8000-000000000001', now() + interval '7 days', null);

set local role authenticated;
-- Mixed case on purpose: matching is case-insensitive.
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000003","email":"New.Hire@demo.teamverse.local","role":"authenticated"}';

select throws_ok($$ select public.accept_invitation('expired-token-000000000000000000') $$,
  '22023', 'invitation expired', 'rejects an expired invitation');
select throws_ok($$ select public.accept_invitation('revoked-token-000000000000000000') $$,
  '22023', 'invitation revoked', 'rejects a revoked invitation');
select throws_ok($$ select public.accept_invitation('wrongmail-token-0000000000000000') $$,
  '42501', 'invitation email does not match signed-in user', 'rejects an invitation for another email');
select throws_ok($$ select public.accept_invitation('unknown-token-000000000000000000') $$,
  'P0002', 'invitation not found', 'rejects an unknown token');
select is(public.accept_invitation('valid-token-00000000000000000000'),
  'd0000000-0000-4000-8000-000000000001'::uuid, 'accepts a valid invitation and returns the org id');
select throws_ok($$ select public.accept_invitation('valid-token-00000000000000000000') $$,
  '22023', 'invitation already accepted', 'an invitation cannot be used twice');
select is_empty($$ select 1 from public.org_invitations $$, 'invitee cannot read invitations through RLS');
select ok(public.is_org_member('d0000000-0000-4000-8000-000000000001'), 'invitee is now an org member');

reset role;
select is((select role::text from public.memberships
           where user_id = 'b0000000-0000-4000-8000-000000000003'), 'member', 'membership has the invited role');
select is((select count(*) from public.audit_events
           where action = 'invitation.accepted' and actor_id = 'b0000000-0000-4000-8000-000000000003'),
          1::bigint, 'acceptance is audited');

-- invitation_preview is the only anon entry point
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select status from public.invitation_preview('expired-token-000000000000000000')),
  'expired', 'anon preview reports expired status');
select is_empty($$ select * from public.invitation_preview('unknown-token-000000000000000000') $$,
  'anon preview returns nothing for an unknown token');
select throws_ok($$ select public.accept_invitation('wrongmail-token-0000000000000000') $$,
  '42501', null, 'anon cannot accept invitations');

reset role;

select * from finish();
rollback;
