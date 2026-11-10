begin;

-- Apply pets.sql and profiles.sql first.
do $$
begin
  if to_regclass('public.pawsup_pets') is null
     or to_regclass('public.pawsup_profiles') is null then
    raise exception '请先执行 pets.sql 和 profiles.sql';
  end if;
end;
$$;

create table if not exists public.pawsup_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null default auth.uid(),
  author_name text not null check (char_length(author_name) between 1 and 24),
  kind text not null check (kind in ('chat', 'buddy', 'lost', 'service')),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  category text not null check (char_length(category) between 1 and 32),
  service_role text check (service_role in ('find', 'offer')),
  service_kind text check (char_length(service_kind) <= 32),
  price numeric(10,2) check (price between 0 and 100000),
  location text not null default '' check (char_length(location) <= 100),
  when_text text not null default '' check (char_length(when_text) <= 100),
  image_paths text[] not null default '{}' check (cardinality(image_paths) <= 3),
  status text not null default 'published' check (status in ('published', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'chat' or (btrim(location) <> '' and btrim(when_text) <> '')),
  check (kind <> 'service' or (service_role is not null and coalesce(btrim(service_kind), '') <> ''))
);
create index if not exists pawsup_posts_feed_idx on public.pawsup_posts (status, created_at desc, id);
create index if not exists pawsup_posts_author_idx on public.pawsup_posts (owner_id);
create index if not exists pawsup_posts_images_idx on public.pawsup_posts using gin (image_paths);

create table if not exists public.pawsup_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.pawsup_posts(id) on delete cascade,
  owner_id text not null default auth.uid(),
  author_name text not null check (char_length(author_name) between 1 and 24),
  content text not null check (char_length(btrim(content)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists pawsup_comments_post_idx on public.pawsup_comments (post_id, created_at);

create table if not exists public.pawsup_likes (
  post_id uuid not null references public.pawsup_posts(id) on delete cascade,
  owner_id text not null default auth.uid(),
  primary key (post_id, owner_id)
);

create table if not exists public.pawsup_follows (
  follower_id text not null default auth.uid(),
  following_id text not null check (char_length(following_id) between 1 and 64),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.pawsup_service_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id text not null default auth.uid(),
  applicant_name text not null check (char_length(applicant_name) between 1 and 24),
  post_id uuid not null references public.pawsup_posts(id) on delete cascade,
  direction text not null check (direction in ('buyer', 'provider')),
  status text not null default 'pending' check (status in ('pending', 'cancelled')),
  created_at timestamptz not null default now()
);
create unique index if not exists pawsup_active_application_idx
  on public.pawsup_service_applications (post_id, applicant_id) where status = 'pending';

-- The actor name is a snapshot. Private profile fields are never exposed in the feed.
create or replace function public.pawsup_community_actor_name(actor text)
returns text language sql stable security invoker set search_path = '' as $$
  select left(coalesce(
    (select display_name from public.pawsup_profiles where id = actor),
    nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'name'), ''),
    nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'nickName'), ''),
    '铲屎官'
  ), 24);
$$;
revoke all on function public.pawsup_community_actor_name(text) from public, anon;
grant execute on function public.pawsup_community_actor_name(text) to authenticated;

create or replace function public.pawsup_validate_post()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.pawsup_pets where owner_id = new.owner_id) then
    raise exception '请先添加宠物档案' using errcode = '23514';
  end if;
  if coalesce(array_ndims(new.image_paths), 1) <> 1
    or cardinality(new.image_paths) <> (select count(distinct path) from unnest(new.image_paths) as i(path))
    or exists (
      select 1 from unnest(new.image_paths) as i(path)
      where storage.foldername(path) is distinct from array[new.owner_id]
         or storage.filename(path) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
    )
  then
    raise exception '帖子只能引用自己的有效图片' using errcode = '23514';
  end if;
  new.author_name := public.pawsup_community_actor_name(new.owner_id);
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.pawsup_set_comment_author()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.author_name := public.pawsup_community_actor_name(new.owner_id);
  return new;
end;
$$;

create or replace function public.pawsup_validate_application()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target public.pawsup_posts%rowtype;
begin
  select * into target from public.pawsup_posts where id = new.post_id and status = 'published';
  if target.id is null or target.kind <> 'service' or target.owner_id = new.applicant_id
     or new.direction <> (case when target.service_role = 'offer' then 'buyer' else 'provider' end) then
    raise exception '无法向该帖子提交此服务意向' using errcode = '23514';
  end if;
  if not exists (select 1 from public.pawsup_pets where owner_id = new.applicant_id) then
    raise exception '请先添加宠物档案' using errcode = '23514';
  end if;
  new.applicant_name := public.pawsup_community_actor_name(new.applicant_id);
  return new;
end;
$$;

drop trigger if exists pawsup_validate_post on public.pawsup_posts;
create trigger pawsup_validate_post before insert or update on public.pawsup_posts
  for each row execute function public.pawsup_validate_post();
drop trigger if exists pawsup_set_comment_author on public.pawsup_comments;
create trigger pawsup_set_comment_author before insert on public.pawsup_comments
  for each row execute function public.pawsup_set_comment_author();
drop trigger if exists pawsup_validate_application on public.pawsup_service_applications;
create trigger pawsup_validate_application before insert on public.pawsup_service_applications
  for each row execute function public.pawsup_validate_application();
revoke all on function public.pawsup_validate_post(), public.pawsup_set_comment_author(),
  public.pawsup_validate_application() from public, anon, authenticated;

alter table public.pawsup_posts enable row level security;
revoke all on public.pawsup_posts from public, anon, authenticated;
revoke all (id, owner_id, author_name, kind, title, content, category, service_role, service_kind, price, location, when_text, image_paths, status, created_at, updated_at) on public.pawsup_posts from public, anon, authenticated;
grant select, delete on public.pawsup_posts to authenticated;
grant insert (kind, title, content, category, service_role, service_kind, price, location, when_text, image_paths) on public.pawsup_posts to authenticated;
grant update (kind, title, content, category, service_role, service_kind, price, location, when_text, image_paths) on public.pawsup_posts to authenticated;
drop policy if exists pawsup_posts_role_guard on public.pawsup_posts;
create policy pawsup_posts_role_guard on public.pawsup_posts
  as restrictive for all to public
  using (current_user = 'authenticated')
  with check (current_user = 'authenticated');
drop policy if exists pawsup_posts_select on public.pawsup_posts;
create policy pawsup_posts_select on public.pawsup_posts
  for select to authenticated
  using (status = 'published' or owner_id = (select auth.uid()));
drop policy if exists pawsup_posts_select_guard on public.pawsup_posts;
create policy pawsup_posts_select_guard on public.pawsup_posts
  as restrictive for select to authenticated
  using (status = 'published' or owner_id = (select auth.uid()));
drop policy if exists pawsup_posts_insert on public.pawsup_posts;
create policy pawsup_posts_insert on public.pawsup_posts
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'published');
drop policy if exists pawsup_posts_insert_guard on public.pawsup_posts;
create policy pawsup_posts_insert_guard on public.pawsup_posts
  as restrictive for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'published');
drop policy if exists pawsup_posts_update on public.pawsup_posts;
create policy pawsup_posts_update on public.pawsup_posts
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists pawsup_posts_update_guard on public.pawsup_posts;
create policy pawsup_posts_update_guard on public.pawsup_posts
  as restrictive for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists pawsup_posts_delete on public.pawsup_posts;
create policy pawsup_posts_delete on public.pawsup_posts
  for delete to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists pawsup_posts_delete_guard on public.pawsup_posts;
create policy pawsup_posts_delete_guard on public.pawsup_posts
  as restrictive for delete to authenticated
  using (owner_id = (select auth.uid()));

alter table public.pawsup_comments enable row level security;
revoke all on public.pawsup_comments from public, anon, authenticated;
revoke all (id, post_id, owner_id, author_name, content, created_at) on public.pawsup_comments from public, anon, authenticated;
grant select on public.pawsup_comments to authenticated;
grant insert (post_id, content) on public.pawsup_comments to authenticated;
drop policy if exists pawsup_comments_role_guard on public.pawsup_comments;
create policy pawsup_comments_role_guard on public.pawsup_comments
  as restrictive for all to public
  using (current_user = 'authenticated')
  with check (current_user = 'authenticated');
drop policy if exists pawsup_comments_select on public.pawsup_comments;
create policy pawsup_comments_select on public.pawsup_comments
  for select to authenticated
  using (exists (select 1 from public.pawsup_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists pawsup_comments_select_guard on public.pawsup_comments;
create policy pawsup_comments_select_guard on public.pawsup_comments
  as restrictive for select to authenticated
  using (exists (select 1 from public.pawsup_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists pawsup_comments_insert on public.pawsup_comments;
create policy pawsup_comments_insert on public.pawsup_comments
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.pawsup_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists pawsup_comments_insert_guard on public.pawsup_comments;
create policy pawsup_comments_insert_guard on public.pawsup_comments
  as restrictive for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.pawsup_posts p where p.id = post_id and p.status = 'published'));

alter table public.pawsup_likes enable row level security;
revoke all on public.pawsup_likes from public, anon, authenticated;
revoke all (post_id, owner_id) on public.pawsup_likes from public, anon, authenticated;
grant select, delete on public.pawsup_likes to authenticated;
grant insert (post_id) on public.pawsup_likes to authenticated;
drop policy if exists pawsup_likes_role_guard on public.pawsup_likes;
create policy pawsup_likes_role_guard on public.pawsup_likes
  as restrictive for all to public
  using (current_user = 'authenticated')
  with check (current_user = 'authenticated');
drop policy if exists pawsup_likes_select on public.pawsup_likes;
create policy pawsup_likes_select on public.pawsup_likes
  for select to authenticated
  using (exists (select 1 from public.pawsup_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists pawsup_likes_select_guard on public.pawsup_likes;
create policy pawsup_likes_select_guard on public.pawsup_likes
  as restrictive for select to authenticated
  using (exists (select 1 from public.pawsup_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists pawsup_likes_insert on public.pawsup_likes;
create policy pawsup_likes_insert on public.pawsup_likes
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.pawsup_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists pawsup_likes_insert_guard on public.pawsup_likes;
create policy pawsup_likes_insert_guard on public.pawsup_likes
  as restrictive for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.pawsup_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists pawsup_likes_delete on public.pawsup_likes;
create policy pawsup_likes_delete on public.pawsup_likes
  for delete to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists pawsup_likes_delete_guard on public.pawsup_likes;
create policy pawsup_likes_delete_guard on public.pawsup_likes
  as restrictive for delete to authenticated
  using (owner_id = (select auth.uid()));

alter table public.pawsup_follows enable row level security;
revoke all on public.pawsup_follows from public, anon, authenticated;
revoke all (follower_id, following_id) on public.pawsup_follows from public, anon, authenticated;
grant select, delete on public.pawsup_follows to authenticated;
grant insert (following_id) on public.pawsup_follows to authenticated;
drop policy if exists pawsup_follows_role_guard on public.pawsup_follows;
create policy pawsup_follows_role_guard on public.pawsup_follows
  as restrictive for all to public
  using (current_user = 'authenticated')
  with check (current_user = 'authenticated');
drop policy if exists pawsup_follows_select on public.pawsup_follows;
create policy pawsup_follows_select on public.pawsup_follows
  for select to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));
drop policy if exists pawsup_follows_select_guard on public.pawsup_follows;
create policy pawsup_follows_select_guard on public.pawsup_follows
  as restrictive for select to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));
drop policy if exists pawsup_follows_insert on public.pawsup_follows;
create policy pawsup_follows_insert on public.pawsup_follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()) and exists (select 1 from public.pawsup_posts p where p.owner_id = following_id and p.status = 'published'));
drop policy if exists pawsup_follows_insert_guard on public.pawsup_follows;
create policy pawsup_follows_insert_guard on public.pawsup_follows
  as restrictive for insert to authenticated
  with check (follower_id = (select auth.uid()) and exists (select 1 from public.pawsup_posts p where p.owner_id = following_id and p.status = 'published'));
drop policy if exists pawsup_follows_delete on public.pawsup_follows;
create policy pawsup_follows_delete on public.pawsup_follows
  for delete to authenticated
  using (follower_id = (select auth.uid()));
drop policy if exists pawsup_follows_delete_guard on public.pawsup_follows;
create policy pawsup_follows_delete_guard on public.pawsup_follows
  as restrictive for delete to authenticated
  using (follower_id = (select auth.uid()));

alter table public.pawsup_service_applications enable row level security;
revoke all on public.pawsup_service_applications from public, anon, authenticated;
revoke all (id, applicant_id, applicant_name, post_id, direction, status, created_at) on public.pawsup_service_applications from public, anon, authenticated;
grant select on public.pawsup_service_applications to authenticated;
grant insert (post_id, direction) on public.pawsup_service_applications to authenticated;
grant update (status) on public.pawsup_service_applications to authenticated;
drop policy if exists pawsup_service_applications_role_guard on public.pawsup_service_applications;
create policy pawsup_service_applications_role_guard on public.pawsup_service_applications
  as restrictive for all to public
  using (current_user = 'authenticated')
  with check (current_user = 'authenticated');
drop policy if exists pawsup_service_applications_select on public.pawsup_service_applications;
create policy pawsup_service_applications_select on public.pawsup_service_applications
  for select to authenticated
  using (applicant_id = (select auth.uid()) or exists (select 1 from public.pawsup_posts p where p.id = post_id and p.owner_id = (select auth.uid())));
drop policy if exists pawsup_service_applications_select_guard on public.pawsup_service_applications;
create policy pawsup_service_applications_select_guard on public.pawsup_service_applications
  as restrictive for select to authenticated
  using (applicant_id = (select auth.uid()) or exists (select 1 from public.pawsup_posts p where p.id = post_id and p.owner_id = (select auth.uid())));
drop policy if exists pawsup_service_applications_insert on public.pawsup_service_applications;
create policy pawsup_service_applications_insert on public.pawsup_service_applications
  for insert to authenticated
  with check (applicant_id = (select auth.uid()) and status = 'pending');
drop policy if exists pawsup_service_applications_insert_guard on public.pawsup_service_applications;
create policy pawsup_service_applications_insert_guard on public.pawsup_service_applications
  as restrictive for insert to authenticated
  with check (applicant_id = (select auth.uid()) and status = 'pending');
drop policy if exists pawsup_service_applications_update on public.pawsup_service_applications;
create policy pawsup_service_applications_update on public.pawsup_service_applications
  for update to authenticated
  using (applicant_id = (select auth.uid()) and status = 'pending')
  with check (applicant_id = (select auth.uid()) and status = 'cancelled');
drop policy if exists pawsup_service_applications_update_guard on public.pawsup_service_applications;
create policy pawsup_service_applications_update_guard on public.pawsup_service_applications
  as restrictive for update to authenticated
  using (applicant_id = (select auth.uid()) and status = 'pending')
  with check (applicant_id = (select auth.uid()) and status = 'cancelled');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pawsup-post-images', 'pawsup-post-images', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists pawsup_post_bucket_no_insert on storage.buckets;
create policy pawsup_post_bucket_no_insert on storage.buckets
  as restrictive for insert to anon, authenticated
  with check (id <> 'pawsup-post-images');
drop policy if exists pawsup_post_bucket_no_update on storage.buckets;
create policy pawsup_post_bucket_no_update on storage.buckets
  as restrictive for update to anon, authenticated
  using (id <> 'pawsup-post-images')
  with check (id <> 'pawsup-post-images');
drop policy if exists pawsup_post_bucket_no_delete on storage.buckets;
create policy pawsup_post_bucket_no_delete on storage.buckets
  as restrictive for delete to anon, authenticated
  using (id <> 'pawsup-post-images');
drop policy if exists pawsup_post_images_no_anon on storage.objects;
create policy pawsup_post_images_no_anon on storage.objects
  as restrictive for all to anon
  using (bucket_id <> 'pawsup-post-images')
  with check (bucket_id <> 'pawsup-post-images');
drop policy if exists pawsup_post_images_no_update on storage.objects;
create policy pawsup_post_images_no_update on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'pawsup-post-images')
  with check (bucket_id <> 'pawsup-post-images');
drop policy if exists pawsup_post_images_select on storage.objects;
create policy pawsup_post_images_select on storage.objects
  for select to authenticated
  using (bucket_id = 'pawsup-post-images' and (((owner_id = (select auth.uid()) and storage.foldername(name) = array[(select auth.uid())]) or exists (
    select 1 from public.pawsup_posts p
    where p.status = 'published'
      and p.owner_id = storage.objects.owner_id
      and p.image_paths @> array[storage.objects.name]
  ))));
drop policy if exists pawsup_post_images_select_guard on storage.objects;
create policy pawsup_post_images_select_guard on storage.objects
  as restrictive for select to authenticated
  using (bucket_id <> 'pawsup-post-images' or (((owner_id = (select auth.uid()) and storage.foldername(name) = array[(select auth.uid())]) or exists (
    select 1 from public.pawsup_posts p
    where p.status = 'published'
      and p.owner_id = storage.objects.owner_id
      and p.image_paths @> array[storage.objects.name]
  ))));
drop policy if exists pawsup_post_images_insert on storage.objects;
create policy pawsup_post_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pawsup-post-images' and (owner_id = (select auth.uid()) and storage.foldername(name) = array[(select auth.uid())] and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'));
drop policy if exists pawsup_post_images_insert_guard on storage.objects;
create policy pawsup_post_images_insert_guard on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'pawsup-post-images' or (owner_id = (select auth.uid()) and storage.foldername(name) = array[(select auth.uid())] and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'));
drop policy if exists pawsup_post_images_delete on storage.objects;
create policy pawsup_post_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'pawsup-post-images' and (owner_id = (select auth.uid()) and storage.foldername(name) = array[(select auth.uid())]));
drop policy if exists pawsup_post_images_delete_guard on storage.objects;
create policy pawsup_post_images_delete_guard on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'pawsup-post-images' or (owner_id = (select auth.uid()) and storage.foldername(name) = array[(select auth.uid())]));

notify pgrst, 'reload schema';
commit;
