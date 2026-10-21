-- =============================================================================
-- DEMO DATA -- "Dubai Agency (Demo)"
-- =============================================================================
-- * Every person, message and seat below is FICTIONAL demo data, clearly
--   labelled with organizations.is_demo = true.
-- * All demo accounts share the password:  demo-password-123
--   Emails use the non-routable domain @demo.teamverse.local.
-- * NEVER run this file against a production database. It is loaded only by
--   `supabase db reset` on a local stack.
-- * Fixed UUIDs are used so tests can reference rows:
--     org            d0000000-0000-4000-8000-000000000001
--     users          a0000000-0000-4000-8000-0000000000NN  (01..11)
--     departments    de000000-0000-4000-8000-00000000000N  (1..5)
--     office layout  f0000000-0000-4000-8000-000000000001
--     seats          f5000000-0000-4000-8000-0000000000NN
--     conversations  c0000000-0000-4000-8000-000000000001  channel eng-architecture (private)
--                    c0000000-0000-4000-8000-000000000002  DM Zayd Benali <-> Layla Nour
--                    c0000000-0000-4000-8000-000000000003  channel general-announcements (public)
--                    c0000000-0000-4000-8000-000000000004  channel design-critique (public)
--                    c0000000-0000-4000-8000-000000000005  channel client-showcase (private)
--                    c0000000-0000-4000-8000-000000000006  DM Tariq Mansour <-> Sara Al-Hashimi
--                    c0000000-0000-4000-8000-000000000007  DM Zayd Benali <-> Tariq Mansour
--     The owner (Demo Admin, a...01) is deliberately in NO conversation: RLS
--     tests rely on it, and it shows the "browse public channels" path.
--     messages       e0000000-0000-4000-8000-0000000000NN
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Demo people
-- -----------------------------------------------------------------------------
create temporary table _demo_users (
  id            uuid primary key,
  email         text not null,
  display_name  text not null,
  title         text not null,
  role          public.membership_role not null,
  department    text  -- department slug, null = no department
);

insert into _demo_users (id, email, display_name, title, role, department) values
  ('a0000000-0000-4000-8000-000000000001', 'admin@demo.teamverse.local',            'Demo Admin',      'Workspace Owner',             'owner',  null),
  ('a0000000-0000-4000-8000-000000000002', 'tariq.mansour@demo.teamverse.local',    'Tariq Mansour',   'VP Engineering',              'admin',  'development'),
  ('a0000000-0000-4000-8000-000000000003', 'sara.alhashimi@demo.teamverse.local',   'Sara Al-Hashimi', 'Lead UI/UX Designer',         'admin',  'design'),
  ('a0000000-0000-4000-8000-000000000004', 'zayd.benali@demo.teamverse.local',      'Zayd Benali',     'Senior Full-Stack Engineer',  'member', 'development'),
  ('a0000000-0000-4000-8000-000000000005', 'noor.khalid@demo.teamverse.local',      'Noor Khalid',     'Marketing Lead',              'member', 'marketing'),
  ('a0000000-0000-4000-8000-000000000006', 'layla.nour@demo.teamverse.local',       'Layla Nour',      'Product Designer',            'member', 'design'),
  ('a0000000-0000-4000-8000-000000000007', 'hamdan.zayed@demo.teamverse.local',     'Hamdan Zayed',    'Project Manager',             'member', 'project-management'),
  ('a0000000-0000-4000-8000-000000000008', 'nour.merhi@demo.teamverse.local',       'Nour Merhi',      'Scrum Master',                'member', 'project-management'),
  ('a0000000-0000-4000-8000-000000000009', 'fatima.rashid@demo.teamverse.local',    'Fatima Rashid',   'Content Strategist',          'member', 'marketing'),
  ('a0000000-0000-4000-8000-000000000010', 'marcus.sterling@demo.teamverse.local',  'Marcus Sterling', 'Delivery Director',           'member', 'project-management'),
  ('a0000000-0000-4000-8000-000000000011', 'zaid.chen@demo.teamverse.local',        'Zaid Chen',       'Frontend Engineer',           'member', 'development');

-- auth.users (the on_auth_user_created trigger creates public.profiles rows).
-- Empty-string token columns are required: local GoTrue cannot scan NULLs there.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('demo-password-123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', u.display_name),
  now(),
  now(),
  '', '', '', '', '', ''
from _demo_users u;

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  u.id,
  u.id,
  u.id::text,
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(),
  now(),
  now()
from _demo_users u;

update public.profiles p
   set title = u.title,
       timezone = 'Asia/Dubai',
       locale = 'en'
  from _demo_users u
 where p.id = u.id;

-- -----------------------------------------------------------------------------
-- Organization + departments
-- -----------------------------------------------------------------------------
insert into public.organizations (id, name, slug, timezone, is_demo)
values ('d0000000-0000-4000-8000-000000000001', 'Dubai Agency (Demo)', 'demo-dubai-agency', 'Asia/Dubai', true);

-- Names stay English; the UI translates by slug.
insert into public.departments (id, org_id, name, slug, color_token, sort_order) values
  ('de000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Development',        'development',        'dept-development',        1),
  ('de000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'Design',             'design',             'dept-design',             2),
  ('de000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'Marketing',          'marketing',          'dept-marketing',          3),
  ('de000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'Project Management', 'project-management', 'dept-project-management', 4),
  ('de000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001', 'Meeting Room',       'meeting-room',       'dept-meeting-room',       5);

insert into public.memberships (org_id, user_id, role, department_id)
select 'd0000000-0000-4000-8000-000000000001', u.id, u.role, d.id
from _demo_users u
left join public.departments d
  on d.org_id = 'd0000000-0000-4000-8000-000000000001' and d.slug = u.department;

-- -----------------------------------------------------------------------------
-- Office layout (PLACEHOLDER scene description until final 3D assets arrive)
-- Units are scene metres; rooms are axis-aligned boxes on the floor plane.
-- -----------------------------------------------------------------------------
insert into public.office_layouts (id, org_id, name, is_active, scene) values (
  'f0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'Main Office (Demo)',
  true,
  '{
     "version": 1,
     "placeholder": true,
     "rooms": [
       {"department": "development",        "x": -8, "z": -6, "width": 10, "depth": 8},
       {"department": "design",             "x":  4, "z": -6, "width":  8, "depth": 8},
       {"department": "marketing",          "x": -8, "z":  4, "width": 10, "depth": 7},
       {"department": "project-management", "x":  4, "z":  4, "width":  8, "depth": 7},
       {"department": "meeting-room",       "x": 14, "z": -1, "width":  7, "depth": 9}
     ]
   }'::jsonb
);

insert into public.office_seats (id, org_id, layout_id, department_id, label, position, assigned_user_id) values
  -- Development
  ('f5000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'DEV-1', '{"x":-10,"y":0,"z":-8,"rotation":0}',   'a0000000-0000-4000-8000-000000000002'),
  ('f5000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'DEV-2', '{"x":-8,"y":0,"z":-8,"rotation":0}',    'a0000000-0000-4000-8000-000000000004'),
  ('f5000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'DEV-3', '{"x":-6,"y":0,"z":-8,"rotation":0}',    'a0000000-0000-4000-8000-000000000011'),
  ('f5000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'DEV-4', '{"x":-8,"y":0,"z":-4,"rotation":180}',  null),
  -- Design
  ('f5000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000002', 'DES-1', '{"x":3,"y":0,"z":-8,"rotation":0}',     'a0000000-0000-4000-8000-000000000003'),
  ('f5000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000002', 'DES-2', '{"x":5,"y":0,"z":-8,"rotation":0}',     'a0000000-0000-4000-8000-000000000006'),
  ('f5000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000002', 'DES-3', '{"x":4,"y":0,"z":-4,"rotation":180}',   null),
  -- Marketing
  ('f5000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000003', 'MKT-1', '{"x":-10,"y":0,"z":3,"rotation":0}',    'a0000000-0000-4000-8000-000000000005'),
  ('f5000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000003', 'MKT-2', '{"x":-8,"y":0,"z":3,"rotation":0}',     'a0000000-0000-4000-8000-000000000009'),
  ('f5000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000003', 'MKT-3', '{"x":-6,"y":0,"z":6,"rotation":180}',   null),
  -- Project Management
  ('f5000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000004', 'PM-1',  '{"x":3,"y":0,"z":3,"rotation":0}',      'a0000000-0000-4000-8000-000000000007'),
  ('f5000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000004', 'PM-2',  '{"x":5,"y":0,"z":3,"rotation":0}',      'a0000000-0000-4000-8000-000000000008'),
  ('f5000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000004', 'PM-3',  '{"x":4,"y":0,"z":6,"rotation":180}',    'a0000000-0000-4000-8000-000000000010'),
  -- Meeting Room (shared, unassigned)
  ('f5000000-0000-4000-8000-000000000014', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000005', 'MTG-1', '{"x":13,"y":0,"z":-3,"rotation":90}',   null),
  ('f5000000-0000-4000-8000-000000000015', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000005', 'MTG-2', '{"x":13,"y":0,"z":1,"rotation":90}',    null),
  ('f5000000-0000-4000-8000-000000000016', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000005', 'MTG-3', '{"x":15,"y":0,"z":-3,"rotation":270}',  null),
  ('f5000000-0000-4000-8000-000000000017', 'd0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000005', 'MTG-4', '{"x":15,"y":0,"z":1,"rotation":270}',   null);

-- -----------------------------------------------------------------------------
-- Conversations
-- -----------------------------------------------------------------------------
insert into public.conversations (id, org_id, kind, name, topic, direct_key, created_by) values
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'channel',
   'eng-architecture', 'Architecture decisions and reviews (demo)', null,
   'a0000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'direct',
   null, null,
   'a0000000-0000-4000-8000-000000000004:a0000000-0000-4000-8000-000000000006',
   'a0000000-0000-4000-8000-000000000004');

insert into public.conversation_members (org_id, conversation_id, user_id, role) values
  -- #eng-architecture: Tariq (owner), Zayd, Zaid Chen, Sara
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'owner'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'member'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'member'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'member'),
  -- DM: Zayd <-> Layla (no admin is a member: used by RLS tests)
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000004', 'member'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000006', 'member');

insert into public.messages (id, org_id, conversation_id, sender_id, body, kind, created_at) values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'Kicking off the architecture review for the client portal. Proposal doc is up.', 'text', now() - interval '3 hours'),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000004', 'Read it. I''d keep the API on edge functions and move reporting to a queue.', 'text', now() - interval '2 hours 40 minutes'),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000011', 'Agreed. The dashboard can stream updates over Realtime instead of polling.', 'text', now() - interval '2 hours 15 minutes'),
  ('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003', 'Design handoff for the new components lands Thursday.', 'text', now() - interval '1 hour 50 minutes'),
  ('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000004', 'Hi Layla, do you have the updated onboarding screens?', 'text', now() - interval '50 minutes'),
  ('e0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000006', 'Yes, sharing them in a few minutes. Still polishing the empty states.', 'text', now() - interval '45 minutes'),
  ('e0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000004', 'Perfect, thanks!', 'text', now() - interval '44 minutes');

insert into public.message_receipts (org_id, conversation_id, message_id, user_id, delivered_at, read_at) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', now() - interval '2 hours 59 minutes', now() - interval '2 hours 45 minutes'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', now() - interval '2 hours 59 minutes', now() - interval '2 hours 20 minutes'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000006', now() - interval '49 minutes', now() - interval '46 minutes'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000004', now() - interval '45 minutes', now() - interval '44 minutes'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000006', now() - interval '44 minutes', null);

update public.conversation_members
   set last_read_at = now() - interval '44 minutes'
 where conversation_id = 'c0000000-0000-4000-8000-000000000002'
   and user_id = 'a0000000-0000-4000-8000-000000000004';

-- -----------------------------------------------------------------------------
-- Phase 3: more channels and DMs
-- -----------------------------------------------------------------------------
insert into public.conversations (id, org_id, kind, visibility, name, topic, direct_key, created_by) values
  ('c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'channel', 'public',
   'general-announcements', 'Company-wide news (demo)', null, 'a0000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'channel', 'public',
   'design-critique', 'Share work in progress for feedback (demo)', null, 'a0000000-0000-4000-8000-000000000003'),
  ('c0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001', 'channel', 'private',
   'client-showcase', 'Prep for client presentations (demo)', null, 'a0000000-0000-4000-8000-000000000010'),
  ('c0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000001', 'direct', 'private',
   null, null, 'a0000000-0000-4000-8000-000000000002:a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000001', 'direct', 'private',
   null, null, 'a0000000-0000-4000-8000-000000000002:a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004');

-- general-announcements: everyone except the owner
insert into public.conversation_members (org_id, conversation_id, user_id, role, last_read_at)
select 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', u.id,
       (case when u.id = 'a0000000-0000-4000-8000-000000000002' then 'owner' else 'member' end)::public.conversation_member_role,
       now() - interval '1 day'
from _demo_users u
where u.id <> 'a0000000-0000-4000-8000-000000000001';

insert into public.conversation_members (org_id, conversation_id, user_id, role) values
  -- design-critique: Sara (owner), Layla, Tariq
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003', 'owner'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000006', 'member'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'member'),
  -- client-showcase: Marcus (owner), Noor, Fatima, Sara
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000010', 'owner'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', 'member'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000009', 'member'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000003', 'member'),
  -- DM Tariq <-> Sara
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000002', 'member'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003', 'member'),
  -- DM Zayd <-> Tariq
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000004', 'member'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000002', 'member');

insert into public.messages (id, org_id, conversation_id, sender_id, body, kind, created_at) values
  ('e0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000002', 'Welcome to TeamVerse! This is **demo data**: every person and message here is fictional.', 'text', now() - interval '5 hours'),
  ('e0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000010', 'Reminder: client review on Thursday at 10:00. Agenda in `#client-showcase`.', 'text', now() - interval '4 hours'),
  ('e0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004',
   'a0000000-0000-4000-8000-000000000006', 'First pass at the onboarding empty states. Thoughts on the illustration weight?', 'text', now() - interval '3 hours 30 minutes'),
  ('e0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004',
   'a0000000-0000-4000-8000-000000000003', E'Looks good. Two notes:\n- tighten the heading spacing\n- use the secondary teal for the CTA', 'text', now() - interval '3 hours 10 minutes'),
  ('e0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005',
   'a0000000-0000-4000-8000-000000000010', 'Deck outline for the pitch is ready. Noor, can you own the case-study slide?', 'text', now() - interval '2 hours'),
  ('e0000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006',
   'a0000000-0000-4000-8000-000000000002', 'Can we sync on the 3D office art direction this week?', 'text', now() - interval '1 hour 20 minutes'),
  ('e0000000-0000-4000-8000-000000000014', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006',
   'a0000000-0000-4000-8000-000000000003', 'Yes, Wednesday afternoon works for me.', 'text', now() - interval '1 hour 5 minutes'),
  ('e0000000-0000-4000-8000-000000000015', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007',
   'a0000000-0000-4000-8000-000000000004', 'Deploy of the staging build is done. Smoke tests are green.', 'text', now() - interval '30 minutes');

update public.conversation_members
   set last_read_at = now() - interval '1 hour'
 where conversation_id = 'c0000000-0000-4000-8000-000000000006'
   and user_id = 'a0000000-0000-4000-8000-000000000003';

-- Demo figures for the 3D office (fictional people; real users pick theirs in Settings).
update public.profiles p set avatar_character = v.c
from (values
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'character-male-a'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'character-female-a'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'character-male-b'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'character-female-b'),
  ('a0000000-0000-4000-8000-000000000006'::uuid, 'character-female-c'),
  ('a0000000-0000-4000-8000-000000000007'::uuid, 'character-male-c'),
  ('a0000000-0000-4000-8000-000000000008'::uuid, 'character-female-d'),
  ('a0000000-0000-4000-8000-000000000009'::uuid, 'character-female-e'),
  ('a0000000-0000-4000-8000-000000000010'::uuid, 'character-male-d'),
  ('a0000000-0000-4000-8000-000000000011'::uuid, 'character-male-e')
) as v(id, c)
where p.id = v.id;

-- Layla has read the DM, but prefers not to share read receipts (shows the opt-out).
update public.conversation_members
   set last_read_at = now() - interval '30 minutes'
 where conversation_id = 'c0000000-0000-4000-8000-000000000002'
   and user_id = 'a0000000-0000-4000-8000-000000000006';
update public.profiles set share_read_receipts = false
 where id = 'a0000000-0000-4000-8000-000000000006';

drop table _demo_users;
