begin;

-- Fail before creating the trip table if the pet migration has not been applied.
do $$
begin
  if to_regclass('public.pawsup_pets') is null then
    raise exception '请先执行 cloudbase/pets.sql';
  end if;
end;
$$;

create table if not exists public.pawsup_trips (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null default auth.uid(),
  city text not null check (char_length(btrim(city)) between 1 and 30),
  departure_at timestamptz not null,
  pet_ids uuid[] not null check (cardinality(pet_ids) > 0),
  scene_ids text[] not null check (cardinality(scene_ids) between 1 and 9),
  stops jsonb not null default '[]' check (jsonb_typeof(stops) = 'array'),
  checklist text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pawsup_trips_owner_departure_idx
  on public.pawsup_trips (owner_id, departure_at desc, id);

alter table public.pawsup_trips enable row level security;
revoke all on public.pawsup_trips from public, anon, authenticated;
revoke all (id, owner_id, city, departure_at, pet_ids, scene_ids, stops, checklist, created_at, updated_at)
  on public.pawsup_trips from public, anon, authenticated;
grant select, delete on public.pawsup_trips to authenticated;
grant insert (city, departure_at, pet_ids, scene_ids, stops, checklist),
      update (city, departure_at, pet_ids, scene_ids, stops, checklist)
  on public.pawsup_trips to authenticated;

drop policy if exists pawsup_trips_owner on public.pawsup_trips;
create policy pawsup_trips_owner on public.pawsup_trips
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists pawsup_trips_owner_guard on public.pawsup_trips;
create policy pawsup_trips_owner_guard on public.pawsup_trips
  as restrictive for all to public
  using (current_user = 'authenticated' and owner_id = (select auth.uid()))
  with check (current_user = 'authenticated' and owner_id = (select auth.uid()));

create or replace function public.pawsup_validate_trip_pets()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not isfinite(new.departure_at) then
    raise exception '请选择有效出发时间' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' or new.departure_at is distinct from old.departure_at then
    if new.departure_at <= statement_timestamp() then
      raise exception '出发时间应晚于当前时间' using errcode = '23514';
    end if;
  end if;

  if array_ndims(new.pet_ids) is distinct from 1
    or cardinality(new.pet_ids) <> (select count(distinct pet_id) from unnest(new.pet_ids) as ids(pet_id))
  then
    raise exception '请选择有效且不重复的同行宠物' using errcode = '23514';
  end if;
  if array_ndims(new.scene_ids) is distinct from 1
    or not (new.scene_ids <@ array['park','cafe','camp','beach','playground','hiking','inn','diner','grooming'])
    or cardinality(new.scene_ids) <> (select count(distinct scene_id) from unnest(new.scene_ids) as ids(scene_id))
  then
    raise exception '请选择有效且不重复的活动场景' using errcode = '23514';
  end if;

  if jsonb_typeof(new.stops) is distinct from 'array' then
    raise exception '行程安排必须是列表' using errcode = '23514';
  end if;
  if jsonb_array_length(new.stops) <> cardinality(new.scene_ids)
    or exists (
      select 1 from jsonb_array_elements(new.stops) as items(stop)
      where jsonb_typeof(stop -> 'title') is distinct from 'string'
         or jsonb_typeof(stop -> 'note') is distinct from 'string'
    )
  then
    raise exception '行程安排与活动场景不匹配' using errcode = '23514';
  end if;

  if exists (
    select 1 from unnest(new.pet_ids) as selected(pet_id)
    where not exists (
      select 1 from public.pawsup_pets pet
      where pet.id = selected.pet_id and pet.owner_id = new.owner_id
    )
  ) then
    raise exception '同行宠物档案已变更，请重新选择' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pawsup_validate_trip_pets on public.pawsup_trips;
create trigger pawsup_validate_trip_pets before insert or update on public.pawsup_trips
  for each row execute function public.pawsup_validate_trip_pets();
revoke execute on function public.pawsup_validate_trip_pets() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
