begin;

-- Requires community.sql. Each follow is visible only to its two participants.
alter policy pawsup_follows_select on public.pawsup_follows
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));
alter policy pawsup_follows_select_guard on public.pawsup_follows
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

-- Improve existing records whose only saved name was the generic fallback.
update public.pawsup_service_applications as intent
set applicant_name = profile.display_name
from public.pawsup_profiles as profile
where intent.applicant_id = profile.id and intent.applicant_name = '铲屎官';

create table if not exists public.pawsup_intent_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.pawsup_service_applications(id) on delete cascade,
  sender_id text not null default auth.uid(),
  content text not null check (char_length(btrim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists pawsup_intent_messages_thread_idx
  on public.pawsup_intent_messages (application_id, created_at desc, id desc);

alter table public.pawsup_intent_messages enable row level security;
revoke all on public.pawsup_intent_messages from public, anon, authenticated;
revoke all (id, application_id, sender_id, content, created_at)
  on public.pawsup_intent_messages from public, anon, authenticated;
grant select on public.pawsup_intent_messages to authenticated;
grant insert (application_id, content) on public.pawsup_intent_messages to authenticated;

-- The referenced intent is itself filtered by its participant-only RLS policy.
drop policy if exists pawsup_intent_messages_participants on public.pawsup_intent_messages;
create policy pawsup_intent_messages_participants on public.pawsup_intent_messages
  for select to authenticated
  using (exists (
    select 1 from public.pawsup_service_applications a where a.id = application_id
  ));
drop policy if exists pawsup_intent_messages_participants_guard on public.pawsup_intent_messages;
create policy pawsup_intent_messages_participants_guard on public.pawsup_intent_messages
  as restrictive for select to authenticated
  using (exists (
    select 1 from public.pawsup_service_applications a where a.id = application_id
  ));

drop policy if exists pawsup_intent_messages_send on public.pawsup_intent_messages;
create policy pawsup_intent_messages_send on public.pawsup_intent_messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and exists (
    select 1 from public.pawsup_service_applications a
    where a.id = application_id and a.status = 'pending'
  ));
drop policy if exists pawsup_intent_messages_send_guard on public.pawsup_intent_messages;
create policy pawsup_intent_messages_send_guard on public.pawsup_intent_messages
  as restrictive for insert to authenticated
  with check (sender_id = (select auth.uid()) and exists (
    select 1 from public.pawsup_service_applications a
    where a.id = application_id and a.status = 'pending'
  ));

notify pgrst, 'reload schema';
commit;
