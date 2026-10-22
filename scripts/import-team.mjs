#!/usr/bin/env node
// Replaces the people of the demo organization with a real team roster, for demos.
//
//   TEAM_PASSWORD='…' node scripts/import-team.mjs <roster.txt> > team.sql
//   docker exec -i supabase_db_teamverse-ai psql -U postgres -d postgres < team.sql
//
// Roster format (one person per line, '#' comments allowed):
//   Name: Department[, owner|admin]
// Departments matching Development / Design / Marketing / Project Management reuse those rooms;
// any other name gets its own room. Logins become <first-name>@demo.teamverse.local (never real
// addresses). Conversations are emptied: no real person "says" anything they didn't.
// The roster file stays local — it is never committed.

import { readFileSync } from "node:fs";

const ORG = "d0000000-0000-4000-8000-000000000001";
const LAYOUT = "f0000000-0000-4000-8000-000000000001";
const MEETING = "meeting-room";
const KNOWN = {
  development: ["development", "dev", "engineering", "tech", "technology"],
  design: ["design", "ux", "ui", "design & ux", "creative"],
  marketing: ["marketing", "marketing & growth", "growth", "digital marketing", "seo"],
  "project-management": ["project management", "pm", "pm & ops", "operations", "ops", "delivery"],
};

const [file] = process.argv.slice(2);
const password = process.env.TEAM_PASSWORD;
if (!file || !password) {
  console.error("usage: TEAM_PASSWORD=… node scripts/import-team.mjs <roster.txt>");
  process.exit(1);
}

const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const q = (s) => (s === null ? "null" : `'${String(s).replace(/'/g, "''")}'`);

// ---- parse --------------------------------------------------------------------------------------
const people = [];
const problems = [];
for (const [i, raw] of readFileSync(file, "utf8").split("\n").entries()) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const match = /^([^:]+):\s*(.*)$/.exec(line);
  if (!match) { problems.push(`line ${i + 1}: expected "Name: Department"`); continue; }
  const name = match[1].trim();
  const [deptRaw = "", roleRaw = ""] = match[2].split(",").map((s) => s.trim());
  if (!deptRaw) { problems.push(`line ${i + 1}: ${name} has no department`); continue; }
  const lower = deptRaw.toLowerCase();
  const slug = Object.entries(KNOWN).find(([, aliases]) => aliases.includes(lower))?.[0] ?? slugify(deptRaw);
  const role = /owner/i.test(roleRaw) ? "owner" : /admin/i.test(roleRaw) ? "admin" : "member";
  people.push({ name, deptName: deptRaw, slug, role });
}
if (problems.length) { console.error(problems.join("\n")); process.exit(2); }
if (!people.some((p) => p.role === "owner")) people[0].role = "owner";

// Unique demo logins from first names.
const used = new Map();
for (const p of people) {
  const base = slugify(p.name.split(/\s+/)[0]) || "user";
  const n = (used.get(base) ?? 0) + 1;
  used.set(base, n);
  p.email = `${n === 1 ? base : `${base}${n}`}@demo.teamverse.local`;
}

// ---- layout: one room per department, sized to its desks ----------------------------------------
const DESK_X = 2.6, DESK_Z = 3.0, MAX_COLS = 5, GAP = 2.5;
const departments = [...new Map(people.map((p) => [p.slug, p.deptName])).entries()];
const rooms = departments.map(([slug]) => {
  const count = people.filter((p) => p.slug === slug).length;
  const cols = Math.min(MAX_COLS, Math.max(2, Math.ceil(Math.sqrt(count * 1.4))));
  const rows = Math.ceil(count / cols);
  return { slug, count, cols, rows, width: Math.max(7, cols * DESK_X + 2), depth: Math.max(6.5, rows * DESK_Z + 2.6) };
});
// Two columns of rooms, then the meeting room to the side.
let z = 0;
const columnWidth = [0, 0];
rooms.forEach((r, i) => { columnWidth[i % 2] = Math.max(columnWidth[i % 2], r.width); });
for (let i = 0; i < rooms.length; i += 2) {
  const pair = rooms.slice(i, i + 2);
  const depth = Math.max(...pair.map((r) => r.depth));
  pair.forEach((r, j) => {
    r.x = j === 0 ? -(columnWidth[0] / 2 + GAP / 2) : columnWidth[1] / 2 + GAP / 2;
    r.z = z + depth / 2;
  });
  z += depth + GAP;
}
const totalDepth = z - GAP;
for (const r of rooms) r.z -= totalDepth / 2;
const meeting = { slug: MEETING, x: columnWidth[1] + GAP * 1.5 + 3.5, z: 0, width: 7, depth: 9 };

const round = (n) => Math.round(n * 100) / 100;
const scene = {
  version: 1,
  placeholder: true,
  rooms: [...rooms, meeting].map((r) => ({ department: r.slug, x: round(r.x), z: round(r.z), width: round(r.width), depth: round(r.depth) })),
};

const seats = [];
for (const r of rooms) {
  const members = people.filter((p) => p.slug === r.slug);
  const prefix = r.slug.replace(/-/g, "").slice(0, 3).toUpperCase();
  members.forEach((p, i) => {
    const c = i % r.cols, row = Math.floor(i / r.cols);
    seats.push({
      label: `${prefix}-${i + 1}`,
      slug: r.slug,
      email: p.email,
      x: round(r.x - ((r.cols - 1) * DESK_X) / 2 + c * DESK_X),
      z: round(r.z - (r.depth / 2) + 1.4 + row * DESK_Z),
    });
  });
}
const meetingSeats = [[-1.2, -2.4, 0], [1.2, -2.4, 0], [-1.2, 2.4, 180], [1.2, 2.4, 180], [-2.4, 0, 90], [2.4, 0, 270]].map(([dx, dz, rot], i) => ({
  label: `MTG-${i + 1}`, x: round(meeting.x + dx), z: round(meeting.z + dz), rotation: rot,
}));

// ---- SQL ----------------------------------------------------------------------------------------
const out = [];
const sql = (s) => out.push(s);
sql("begin;");
sql(`-- Generated by scripts/import-team.mjs: ${people.length} people, ${rooms.length} department rooms.`);
sql(`delete from public.conversations where org_id = ${q(ORG)};`);
sql(`delete from public.calls where org_id = ${q(ORG)};`);
sql(`delete from public.meetings where org_id = ${q(ORG)};`);
sql(`delete from public.office_seats where layout_id = ${q(LAYOUT)};`);
sql(`delete from public.org_invitations where org_id = ${q(ORG)};`);
sql(`create temporary table _old on commit drop as select m.user_id from public.memberships m join public.profiles p on p.id = m.user_id where m.org_id = ${q(ORG)} and p.email like '%@demo.teamverse.local';`);
sql(`delete from public.memberships where org_id = ${q(ORG)};`);
sql("delete from auth.users where id in (select user_id from _old);");
sql(`delete from public.departments where org_id = ${q(ORG)} and slug <> ${q(MEETING)};`);
sql(`update public.organizations set name = 'GTech (Demo)' where id = ${q(ORG)};`);
sql(`update public.office_layouts set name = 'GTech Office (Demo)', scene = ${q(JSON.stringify(scene))}::jsonb where id = ${q(LAYOUT)};`);

departments.forEach(([slug, name], i) => {
  const token = Object.keys(KNOWN).includes(slug) ? `dept-${slug}` : "primary";
  sql(`insert into public.departments (org_id, name, slug, color_token, sort_order) values (${q(ORG)}, ${q(name)}, ${q(slug)}, ${q(token)}, ${i + 1});`);
});
sql(`update public.departments set sort_order = ${departments.length + 1} where org_id = ${q(ORG)} and slug = ${q(MEETING)};`);

sql("create temporary table _team (id uuid primary key default gen_random_uuid(), email text, name text, role public.membership_role, slug text) on commit drop;");
for (const p of people) sql(`insert into _team (email, name, role, slug) values (${q(p.email)}, ${q(p.name)}, ${q(p.role)}, ${q(p.slug)});`);
sql(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', t.id, 'authenticated', 'authenticated', t.email, extensions.crypt(${q(password)}, extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('display_name', t.name), now(), now(), '', '', '', '', '', ''
from _team t;`);
sql(`insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select t.id, t.id, t.id::text, 'email', jsonb_build_object('sub', t.id::text, 'email', t.email, 'email_verified', true), now(), now(), now() from _team t;`);
sql("update public.profiles p set display_name = t.name, title = null, timezone = 'Asia/Dubai', locale = 'en', availability = 'online' from _team t where p.id = t.id;");
sql(`insert into public.memberships (org_id, user_id, role, department_id)
select ${q(ORG)}, t.id, t.role, d.id from _team t join public.departments d on d.org_id = ${q(ORG)} and d.slug = t.slug;`);

for (const s of seats) {
  sql(`insert into public.office_seats (org_id, layout_id, department_id, label, position, assigned_user_id)
select ${q(ORG)}, ${q(LAYOUT)}, d.id, ${q(s.label)}, ${q(JSON.stringify({ x: s.x, y: 0, z: s.z, rotation: 0 }))}::jsonb, t.id
from _team t join public.departments d on d.org_id = ${q(ORG)} and d.slug = ${q(s.slug)} where t.email = ${q(s.email)};`);
}
for (const s of meetingSeats) {
  sql(`insert into public.office_seats (org_id, layout_id, department_id, label, position)
select ${q(ORG)}, ${q(LAYOUT)}, d.id, ${q(s.label)}, ${q(JSON.stringify({ x: s.x, y: 0, z: s.z, rotation: s.rotation }))}::jsonb
from public.departments d where d.org_id = ${q(ORG)} and d.slug = ${q(MEETING)};`);
}

// Empty channels to start from: everyone in #general, each department in its own channel.
const channel = (name, topic, slugFilter) => {
  sql(`with c as (insert into public.conversations (org_id, kind, visibility, name, topic, created_by)
  select ${q(ORG)}, 'channel', 'public', ${q(name)}, ${q(topic)}, (select id from _team where role = 'owner' limit 1) returning id)
insert into public.conversation_members (org_id, conversation_id, user_id, role)
select ${q(ORG)}, c.id, t.id, (case when t.role = 'owner' then 'owner' else 'member' end)::public.conversation_member_role
from c, _team t ${slugFilter ? `where t.slug = ${q(slugFilter)}` : ""};`);
};
channel("general", "Company-wide announcements", null);
for (const [slug, name] of departments) channel(slugify(name), `${name} team`, slug);

sql("commit;");
process.stdout.write(out.join("\n") + "\n");
console.error(`OK: ${people.length} people, ${rooms.length} rooms, ${seats.length} desks. Owner: ${people.find((p) => p.role === "owner").name}.`);
console.error(people.map((p) => `  ${p.name.padEnd(20)} ${p.slug.padEnd(20)} ${p.role.padEnd(7)} ${p.email}`).join("\n"));
