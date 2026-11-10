begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  avatar_path text,
  bio text not null default '' check (char_length(bio) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 18),
  species text not null check (species in ('cat','dog','other')),
  breed text not null default '' check (char_length(breed)<=50),
  age text not null default '' check (char_length(age)<=30),
  weight_kg numeric(6,2) check (weight_kg > 0 and weight_kg <= 1000),
  photo_path text,
  bio text not null default '' check (char_length(bio)<=500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,owner_id)
);
create index pets_owner_idx on public.pets(owner_id);
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('chat','buddy','lost','service')),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  category text not null default '养宠交流',
  service_role text check (service_role in ('find','offer')),
  service_kind text,
  price numeric(10,2) check (price >= 0 and price <= 100000),
  location text not null default '' check (char_length(location)<=100),
  when_text text not null default '' check (char_length(when_text)<=100),
  image_paths text[] not null default '{}' check (cardinality(image_paths)<=3),
  status text not null default 'published' check (status in ('published','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,owner_id),
  check (kind='chat' or (btrim(location)<>'' and btrim(when_text)<>'')),
  check (kind<>'service' or service_role is not null)
);
create index posts_feed_idx on public.posts(status,created_at desc);
create index posts_owner_idx on public.posts(owner_id);
create table public.post_pets (
  post_id uuid not null,
  pet_id uuid not null,
  owner_id uuid not null default auth.uid(),
  primary key(post_id,pet_id),
  foreign key(post_id,owner_id) references public.posts(id,owner_id) on delete cascade,
  foreign key(pet_id,owner_id) references public.pets(id,owner_id) on delete cascade
);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments(post_id,created_at);
create table public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,owner_id)
);
create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,following_id),
  check (follower_id<>following_id)
);
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  city text not null check (char_length(btrim(city)) between 1 and 30),
  departure_at timestamptz not null,
  pet_ids uuid[] not null check (cardinality(pet_ids)>0),
  scene_ids text[] not null check (cardinality(scene_ids) between 1 and 9),
  stops jsonb not null default '[]' check (jsonb_typeof(stops)='array'),
  checklist text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trips_owner_idx on public.trips(owner_id,departure_at);
create table public.service_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  direction text not null check (direction in ('buyer','provider')),
  status text not null default 'pending' check (status in ('pending','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index applications_one_pending on public.service_applications(applicant_id,post_id) where status='pending';
create index applications_post_idx on public.service_applications(post_id);
create table public.products (
  id text primary key,
  name text not null,
  category text not null,
  price numeric(10,2) not null check(price>=0),
  image_key text not null,
  active boolean not null default true,
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.product_favorites (
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_id,product_id)
);
create table public.cart_items (
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  quantity integer not null check(quantity between 1 and 99),
  updated_at timestamptz not null default now(),
  primary key(owner_id,product_id)
);
-- AI persistence is prepared, but model calls are intentionally not implemented yet.
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  pet_id uuid,
  title text not null default '新对话' check(char_length(title)<=100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,owner_id),
  foreign key(pet_id,owner_id) references public.pets(id,owner_id)
);
create index ai_conversations_owner_idx on public.ai_conversations(owner_id,created_at desc);
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  owner_id uuid not null,
  role text not null check(role in ('user','assistant')),
  content text not null check(char_length(content) between 1 and 20000),
  created_at timestamptz not null default now(),
  foreign key(conversation_id,owner_id) references public.ai_conversations(id,owner_id) on delete cascade
);
create index ai_messages_conversation_idx on public.ai_messages(conversation_id,created_at);
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null unique,
  model text not null,
  input_tokens integer not null check(input_tokens>=0),
  output_tokens integer not null check(output_tokens>=0),
  created_at timestamptz not null default now()
);
create index ai_usage_owner_time_idx on public.ai_usage(owner_id,created_at);

create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end $$;
do $$ declare t text;begin
  foreach t in array array['profiles','pets','posts','trips','service_applications','cart_items','ai_conversations'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
  end loop;
end $$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id,left(coalesce(nullif(btrim(new.raw_user_meta_data->>'name'),''),'铲屎官'),24));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- Also support running this migration on a project containing registered users.
insert into public.profiles(id,display_name)
select id,left(coalesce(nullif(btrim(raw_user_meta_data->>'name'),''),'铲屎官'),24) from auth.users on conflict do nothing;

create function public.check_pet_prerequisite() returns trigger language plpgsql set search_path='' as $$
begin
  if new.status='removed' then return new;end if;
  if not exists(select 1 from public.pets where owner_id=new.owner_id) then
    raise exception 'Create your pet profile first' using errcode='23514';
  end if;
  return new;
end $$;
create trigger posts_require_pet before insert or update on public.posts for each row execute function public.check_pet_prerequisite();
create function public.check_trip_pets() returns trigger language plpgsql set search_path='' as $$
begin
  if (tg_op='INSERT' or new.departure_at is distinct from old.departure_at) and new.departure_at<=now() then
    raise exception 'Departure must be in the future' using errcode='23514';
  end if;
  if exists(select 1 from unnest(new.pet_ids) pid where not exists(select 1 from public.pets p where p.id=pid and p.owner_id=new.owner_id)) then
    raise exception 'Trip contains unavailable pets' using errcode='23514';
  end if;
  if new.scene_ids <@ array['park','cafe','camp','beach','playground','hiking','inn','diner','grooming']::text[] is not true then
    raise exception 'Unknown trip scene' using errcode='23514';
  end if;
  return new;
end $$;
create trigger trips_validate_pets before insert or update on public.trips for each row execute function public.check_trip_pets();
create function public.check_service_application() returns trigger language plpgsql set search_path='' as $$
declare p public.posts;begin
  select * into p from public.posts where id=new.post_id and status='published';
  if p.id is null or p.kind<>'service' or p.owner_id=new.applicant_id then
    raise exception 'Invalid service application' using errcode='23514';
  end if;
  if not exists(select 1 from public.pets where owner_id=new.applicant_id) then
    raise exception 'Create your pet profile first' using errcode='23514';
  end if;
  if new.direction <> (case when p.service_role='offer' then 'buyer' else 'provider' end) then
    raise exception 'Incorrect service direction' using errcode='23514';
  end if;
  return new;
end $$;
create trigger applications_validate before insert on public.service_applications for each row execute function public.check_service_application();

-- Explicit grants, then RLS governs each row. Anonymous access is not granted.
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select on public.products to authenticated;
grant select,insert,update,delete on public.profiles,public.pets,public.posts,public.post_pets,public.comments,public.likes,public.follows,public.trips,public.service_applications,public.product_favorites,public.cart_items,public.ai_conversations to authenticated;
grant select on public.ai_messages,public.ai_usage to authenticated;
-- Profiles are created by the Auth trigger; clients can only edit public-facing fields.
revoke insert,delete,update on public.profiles from authenticated;
grant update(display_name,avatar_path,bio) on public.profiles to authenticated;
-- Intent cancellation is the only client update. No ownership/status reassignment.
revoke update on public.service_applications from authenticated;
grant update(status) on public.service_applications to authenticated;
revoke delete on public.service_applications from authenticated;
-- Owner IDs cannot be reassigned, even by the existing owner.
do $$ declare t text;begin
 foreach t in array array['pets','posts','trips','ai_conversations'] loop
   execute format('revoke update on public.%I from authenticated',t);
 end loop;
end $$;
grant update(name,species,breed,age,weight_kg,photo_path,bio) on public.pets to authenticated;
grant update(kind,title,content,category,service_role,service_kind,price,location,when_text,image_paths,status) on public.posts to authenticated;
grant update(city,departure_at,pet_ids,scene_ids,stops,checklist) on public.trips to authenticated;
grant update(pet_id,title) on public.ai_conversations to authenticated;

do $$ declare t text;begin
 foreach t in array array['profiles','pets','posts','post_pets','comments','likes','follows','trips','service_applications','products','product_favorites','cart_items','ai_conversations','ai_messages','ai_usage'] loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;
create policy profiles_read on public.profiles for select to authenticated using(true);
create policy profiles_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
-- Shared owner policies for private records.
do $$ declare t text;begin
 foreach t in array array['pets','trips','product_favorites','cart_items','ai_conversations'] loop
  execute format('create policy own_rows on public.%I for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()))',t);
 end loop;
end $$;
create policy posts_read on public.posts for select to authenticated using(status='published' or owner_id=(select auth.uid()));
create policy posts_insert on public.posts for insert to authenticated with check(owner_id=(select auth.uid()));
create policy posts_update on public.posts for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy posts_delete on public.posts for delete to authenticated using(owner_id=(select auth.uid()));
create policy post_pets_own on public.post_pets for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy comments_read on public.comments for select to authenticated using(exists(select 1 from public.posts p where p.id=post_id and p.status='published'));
create policy comments_insert on public.comments for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.posts p where p.id=post_id and p.status='published'));
create policy comments_delete on public.comments for delete to authenticated using(owner_id=(select auth.uid()));
create policy likes_read on public.likes for select to authenticated using(exists(select 1 from public.posts p where p.id=post_id and p.status='published'));
create policy likes_insert on public.likes for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.posts p where p.id=post_id and p.status='published'));
create policy likes_delete on public.likes for delete to authenticated using(owner_id=(select auth.uid()));
create policy follows_read on public.follows for select to authenticated using(true);
create policy follows_insert on public.follows for insert to authenticated with check(follower_id=(select auth.uid()));
create policy follows_delete on public.follows for delete to authenticated using(follower_id=(select auth.uid()));
create policy applications_read on public.service_applications for select to authenticated using(applicant_id=(select auth.uid()) or exists(select 1 from public.posts p where p.id=post_id and p.owner_id=(select auth.uid())));
create policy applications_insert on public.service_applications for insert to authenticated with check(applicant_id=(select auth.uid()) and status='pending');
create policy applications_cancel on public.service_applications for update to authenticated using(applicant_id=(select auth.uid()) and status='pending') with check(applicant_id=(select auth.uid()) and status='cancelled');
create policy products_read on public.products for select to authenticated using(active);
create policy ai_messages_read on public.ai_messages for select to authenticated using(owner_id=(select auth.uid()));
create policy ai_usage_read on public.ai_usage for select to authenticated using(owner_id=(select auth.uid()));
grant select,insert,update,delete on all tables in schema public to service_role;
-- No client inserts into AI messages/usage. Trusted future functions alone write them.
revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.touch_updated_at() from public,anon,authenticated;
revoke all on function public.check_pet_prerequisite() from public,anon,authenticated;
revoke all on function public.check_trip_pets() from public,anon,authenticated;
revoke all on function public.check_service_application() from public,anon,authenticated;

commit;
