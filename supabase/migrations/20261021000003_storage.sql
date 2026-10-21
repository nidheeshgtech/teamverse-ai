-- =============================================================================
-- TeamVerse AI: Storage buckets and policies
-- =============================================================================
-- Both buckets are PRIVATE. Clients read through signed URLs; RLS on
-- storage.objects decides who can create/read/delete objects.
--
-- Path conventions (enforced below):
--   avatars:     {org_id}/{user_id}/{file}          read: org members
--                                                   write: that user only
--   attachments: {org_id}/{conversation_id}/{file}  read/write: conversation
--                                                   members only (no admin bypass)
--
-- storage.objects already has RLS enabled by Supabase; we only add policies.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 2097152,
   array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('attachments', 'attachments', false, 26214400,
   array[
     'image/png', 'image/jpeg', 'image/webp', 'image/gif',
     'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
     'video/mp4', 'video/webm',
     'application/pdf', 'text/plain', 'text/csv', 'application/zip',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'application/vnd.openxmlformats-officedocument.presentationml.presentation'
   ])
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Path helpers (SECURITY DEFINER, search_path = '', null-safe on bad paths)
-- -----------------------------------------------------------------------------
create or replace function public.can_read_avatar_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_folders text[] := storage.foldername(object_name);
  v_org uuid := public.try_uuid(v_folders[1]);
begin
  return v_org is not null and public.is_org_member(v_org);
end;
$$;

create or replace function public.can_write_avatar_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_folders text[] := storage.foldername(object_name);
  v_org  uuid := public.try_uuid(v_folders[1]);
  v_user uuid := public.try_uuid(v_folders[2]);
begin
  return v_org is not null
     and v_user is not null
     and v_user = auth.uid()
     and public.is_org_member(v_org);
end;
$$;

create or replace function public.can_access_attachment_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_folders text[] := storage.foldername(object_name);
  v_org  uuid := public.try_uuid(v_folders[1]);
  v_conv uuid := public.try_uuid(v_folders[2]);
begin
  return v_org is not null
     and v_conv is not null
     and exists (
       select 1 from public.conversations c
       where c.id = v_conv and c.org_id = v_org
     )
     and public.is_conversation_member(v_conv);
end;
$$;

revoke execute on function
  public.can_read_avatar_object(text),
  public.can_write_avatar_object(text),
  public.can_access_attachment_object(text)
from public, anon;

grant execute on function
  public.can_read_avatar_object(text),
  public.can_write_avatar_object(text),
  public.can_access_attachment_object(text)
to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- avatars
-- -----------------------------------------------------------------------------
create policy teamverse_avatars_select on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.can_read_avatar_object(name));

create policy teamverse_avatars_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and public.can_write_avatar_object(name));

create policy teamverse_avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and public.can_write_avatar_object(name))
  with check (bucket_id = 'avatars' and public.can_write_avatar_object(name));

create policy teamverse_avatars_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and public.can_write_avatar_object(name));

-- -----------------------------------------------------------------------------
-- attachments (conversation members only; uploader may replace/delete)
-- -----------------------------------------------------------------------------
create policy teamverse_attachments_select on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and public.can_access_attachment_object(name));

create policy teamverse_attachments_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and public.can_access_attachment_object(name));

create policy teamverse_attachments_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'attachments'
    and owner = (select auth.uid())
    and public.can_access_attachment_object(name)
  )
  with check (
    bucket_id = 'attachments'
    and owner = (select auth.uid())
    and public.can_access_attachment_object(name)
  );

create policy teamverse_attachments_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and owner = (select auth.uid())
    and public.can_access_attachment_object(name)
  );
