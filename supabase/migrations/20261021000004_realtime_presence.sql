-- =============================================================================
-- Realtime authorization for ephemeral office presence (Phase 2).
--
-- Clients join the PRIVATE channel `org:<org_id>:presence` and track only the
-- availability they chose. Nothing is persisted: Realtime keeps presence in
-- memory and drops it when the socket closes. These policies make the channel
-- readable/writable only by members of that organization.
-- =============================================================================

create or replace function public.presence_topic_org(topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(topic, ':', 1) = 'org' and split_part(topic, ':', 3) = 'presence'
      then public.try_uuid(split_part(topic, ':', 2))
  end;
$$;

revoke all on function public.presence_topic_org(text) from public;
grant execute on function public.presence_topic_org(text) to authenticated;

create policy "org members receive office presence"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'presence'
    and public.is_org_member(public.presence_topic_org(realtime.topic()))
  );

create policy "org members track office presence"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and public.is_org_member(public.presence_topic_org(realtime.topic()))
  );
