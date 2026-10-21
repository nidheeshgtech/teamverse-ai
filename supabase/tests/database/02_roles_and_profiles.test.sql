-- RLS: (d) no membership role escalation; (e) users update only their own profile.
-- Seed: owner a...01, admins a...02 (Tariq) and a...03 (Sara), member a...04 (Zayd).
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- Fixture: a signed-up user with no org.
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000002',
        'authenticated', 'authenticated', 'outsider@elsewhere.test',
        '{"provider":"email","providers":["email"]}', '{}', now(), now());

-- ---------------------------------------------------------------------------
-- (d) Member tries to escalate
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","email":"zayd.benali@demo.teamverse.local","role":"authenticated"}';

select is_empty(
  $$ update public.memberships set role = 'admin'
     where user_id = 'a0000000-0000-4000-8000-000000000004' returning id $$,
  'member cannot promote themselves to admin');
select is_empty(
  $$ update public.memberships set role = 'owner'
     where user_id = 'a0000000-0000-4000-8000-000000000004' returning id $$,
  'member cannot promote themselves to owner');
select throws_ok(
  $$ insert into public.memberships (org_id, user_id, role)
     values ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'owner') $$,
  '42501', null, 'member cannot add memberships');

-- Admin tries to reach owner
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","email":"tariq.mansour@demo.teamverse.local","role":"authenticated"}';

select throws_ok(
  $$ update public.memberships set role = 'owner'
     where user_id = 'a0000000-0000-4000-8000-000000000002' $$,
  '42501', null, 'admin cannot promote themselves to owner');
select throws_ok(
  $$ update public.memberships set role = 'owner'
     where user_id = 'a0000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'admin cannot promote someone else to owner');
select is_empty(
  $$ update public.memberships set role = 'member'
     where user_id = 'a0000000-0000-4000-8000-000000000001' returning id $$,
  'admin cannot demote the owner');
select is_empty(
  $$ delete from public.memberships
     where user_id = 'a0000000-0000-4000-8000-000000000001' returning id $$,
  'admin cannot remove the owner');
select throws_ok(
  $$ insert into public.memberships (org_id, user_id, role)
     values ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'owner') $$,
  '42501', null, 'admin cannot add a new owner');
select lives_ok(
  $$ insert into public.memberships (org_id, user_id, role)
     values ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'member') $$,
  'admin can add a regular member');

reset role;
select is((select role::text from public.memberships
           where org_id = 'd0000000-0000-4000-8000-000000000001'
             and user_id = 'a0000000-0000-4000-8000-000000000004'),
          'member', 'Zayd is still a member');
delete from public.memberships where user_id = 'b0000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- (e) Profiles
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","email":"zayd.benali@demo.teamverse.local","role":"authenticated"}';

select is_empty(
  $$ update public.profiles set title = 'hacked'
     where id = 'a0000000-0000-4000-8000-000000000006' returning id $$,
  'user cannot update another user''s profile');
select lives_ok(
  $$ update public.profiles set title = 'Staff Engineer', locale = 'ar'
     where id = 'a0000000-0000-4000-8000-000000000004' $$,
  'user can update their own profile');
select throws_ok(
  $$ update public.profiles set email = 'someone@evil.test'
     where id = 'a0000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'user cannot change profiles.email');
select throws_ok(
  $$ update public.profiles set id = 'b0000000-0000-4000-8000-000000000099'
     where id = 'a0000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'user cannot change profiles.id');
select is((select count(*) from public.profiles), 11::bigint, 'user sees profiles of co-members only');

set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000002","email":"outsider@elsewhere.test","role":"authenticated"}';
select is((select count(*) from public.profiles), 1::bigint, 'user with no org sees only their own profile');

reset role;
select is((select title from public.profiles where id = 'a0000000-0000-4000-8000-000000000004'),
  'Staff Engineer', 'own profile update persisted');
select is((select title from public.profiles where id = 'a0000000-0000-4000-8000-000000000006'),
  'Product Designer', 'other profile unchanged');

select * from finish();
rollback;
