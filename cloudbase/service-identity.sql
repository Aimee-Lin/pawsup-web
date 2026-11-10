begin;

-- CloudBase environments can expose different physical metadata columns.
-- Read known nickname keys through the row JSON to avoid undefined-column errors.
-- Resolve only the caller's nickname. Never return email, phone or raw metadata.
create or replace function public.pawsup_community_actor_name(actor text)
returns text language sql stable security definer set search_path = '' as $$
  select case when actor = (select auth.uid()) then left(coalesce(
    (select nullif(nullif(btrim(display_name), ''), '铲屎官')
     from public.pawsup_profiles where id = actor),
    (select coalesce(
      nullif(nullif(btrim(metadata.value ->> 'nickName'), ''), '铲屎官'),
      nullif(nullif(btrim(metadata.value ->> 'name'), ''), '铲屎官'),
      nullif(btrim(metadata.value ->> 'nickname'), '')
    ) from auth.users u
      cross join lateral (select
        coalesce(nullif(to_jsonb(u) -> 'raw_user_meta_data', 'null'::jsonb), '{}'::jsonb)
        || coalesce(nullif(to_jsonb(u) -> 'user_metadata', 'null'::jsonb), '{}'::jsonb) as value
      ) metadata
      where u.id::text = actor),
    nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'nickName'), ''),
    nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'name'), ''),
    '铲屎官'
  ), 24) else '铲屎官' end;
$$;
revoke all on function public.pawsup_community_actor_name(text) from public, anon;
grant execute on function public.pawsup_community_actor_name(text) to authenticated;

-- Profile IDs use the same authenticated ID as applicant_id. This also works
-- when auth.users.id is an internal numeric primary key rather than the JWT sub.
update public.pawsup_service_applications intent
set applicant_name = profile.display_name
from public.pawsup_profiles profile
where intent.applicant_id = profile.id
  and profile.display_name <> '铲屎官'
  and intent.applicant_name is distinct from profile.display_name;

create or replace function public.pawsup_sync_intent_applicant_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.id = (select auth.uid()) and new.display_name <> '铲屎官' then
    update public.pawsup_service_applications
    set applicant_name = new.display_name
    where applicant_id = new.id and applicant_name is distinct from new.display_name;
  end if;
  return new;
end;
$$;
revoke all on function public.pawsup_sync_intent_applicant_name() from public, anon, authenticated;
drop trigger if exists pawsup_sync_intent_applicant_name on public.pawsup_profiles;
create trigger pawsup_sync_intent_applicant_name
  after insert or update of display_name on public.pawsup_profiles
  for each row execute function public.pawsup_sync_intent_applicant_name();

with names as (
  select u.id::text as id, left(coalesce(
    nullif(nullif(btrim(p.display_name), ''), '铲屎官'),
    nullif(nullif(btrim(metadata.value ->> 'nickName'), ''), '铲屎官'),
    nullif(nullif(btrim(metadata.value ->> 'name'), ''), '铲屎官'),
    nullif(nullif(btrim(metadata.value ->> 'nickname'), ''), '铲屎官')
  ), 24) as display_name
  from auth.users u
  cross join lateral (select
    coalesce(nullif(to_jsonb(u) -> 'raw_user_meta_data', 'null'::jsonb), '{}'::jsonb)
    || coalesce(nullif(to_jsonb(u) -> 'user_metadata', 'null'::jsonb), '{}'::jsonb) as value
  ) metadata
  left join public.pawsup_profiles p on p.id = u.id::text
)
update public.pawsup_service_applications intent
set applicant_name = names.display_name
from names
where intent.applicant_id = names.id
  and intent.applicant_name = '铲屎官'
  and names.display_name is not null;

commit;
