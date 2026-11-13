-- Local PostgreSQL counterpart to cloudbase/service-contact.sql.
create table public.intent_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.service_applications(id) on delete cascade,
  sender_id uuid not null default auth.uid(),
  content text not null check (char_length(btrim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index intent_messages_thread_idx
  on public.intent_messages (application_id, created_at desc, id desc);

alter table public.intent_messages enable row level security;
revoke all on public.intent_messages from public, anon, authenticated;
grant select on public.intent_messages to authenticated;
grant insert (application_id, content) on public.intent_messages to authenticated;

create policy intent_messages_read on public.intent_messages for select to authenticated
  using (exists (select 1 from public.service_applications a where a.id = application_id));
create policy intent_messages_send on public.intent_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and exists (
    select 1 from public.service_applications a where a.id = application_id and a.status = 'pending'
  ));
