begin;

create table if not exists public.pawsup_profiles (
  id text primary key default auth.uid(),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 24),
  bio text not null default '' check (char_length(bio) <= 100),
  avatar_path text
);
-- Enforce the same <uid>/<UUID>.jpg shape as the Web uploader on new writes.
-- Keep any pre-existing records available so their owners can replace old avatars.
alter table public.pawsup_profiles drop constraint if exists pawsup_profiles_avatar_key;
alter table public.pawsup_profiles add constraint pawsup_profiles_avatar_key check (
  avatar_path is null or (
    split_part(avatar_path, '/', 1) = id
    and substr(avatar_path, length(id) + 2)
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
  )
) not valid;
alter table public.pawsup_profiles enable row level security;
revoke all on public.pawsup_profiles from public, anon, authenticated;
revoke all (id, display_name, bio, avatar_path) on public.pawsup_profiles from public, anon, authenticated;
grant select on public.pawsup_profiles to authenticated;
grant insert (display_name, bio, avatar_path), update (display_name, bio, avatar_path)
  on public.pawsup_profiles to authenticated;

drop policy if exists pawsup_profiles_owner on public.pawsup_profiles;
create policy pawsup_profiles_owner on public.pawsup_profiles for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists pawsup_profiles_owner_guard on public.pawsup_profiles;
create policy pawsup_profiles_owner_guard on public.pawsup_profiles as restrictive for all to public
  using (current_user = 'authenticated' and id = (select auth.uid()))
  with check (current_user = 'authenticated' and id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pawsup-avatars', 'pawsup-avatars', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only protect this application's bucket, including on shared storage tables.
drop policy if exists pawsup_avatar_bucket_no_insert on storage.buckets;
create policy pawsup_avatar_bucket_no_insert on storage.buckets
  as restrictive for insert to anon, authenticated
  with check (id <> 'pawsup-avatars');
drop policy if exists pawsup_avatar_bucket_no_update on storage.buckets;
create policy pawsup_avatar_bucket_no_update on storage.buckets
  as restrictive for update to anon, authenticated
  using (id <> 'pawsup-avatars')
  with check (id <> 'pawsup-avatars');
drop policy if exists pawsup_avatar_bucket_no_delete on storage.buckets;
create policy pawsup_avatar_bucket_no_delete on storage.buckets
  as restrictive for delete to anon, authenticated
  using (id <> 'pawsup-avatars');

drop policy if exists pawsup_avatars_owner_guard on storage.objects;
create policy pawsup_avatars_owner_guard on storage.objects
  as restrictive for all to public
  using (bucket_id <> 'pawsup-avatars' or (
    current_user = 'authenticated'
    and owner_id = (select auth.uid())
    and (storage.foldername(name))[1] = (select auth.uid())
  ))
  with check (bucket_id <> 'pawsup-avatars' or (
    current_user = 'authenticated'
    and owner_id = (select auth.uid())
    and (storage.foldername(name))[1] = (select auth.uid())
  ));

-- Avatars are replaced with new keys. Block overwrite and moves into or out of this bucket.
drop policy if exists pawsup_avatars_no_update on storage.objects;
create policy pawsup_avatars_no_update on storage.objects
  as restrictive for update to anon, authenticated
  using (bucket_id <> 'pawsup-avatars')
  with check (bucket_id <> 'pawsup-avatars');

drop policy if exists pawsup_avatars_read on storage.objects;
create policy pawsup_avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'pawsup-avatars' and (storage.foldername(name))[1] = (select auth.uid()));
drop policy if exists pawsup_avatars_insert on storage.objects;
create policy pawsup_avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'pawsup-avatars' and (storage.foldername(name))[1] = (select auth.uid()));
drop policy if exists pawsup_avatars_key_guard on storage.objects;
create policy pawsup_avatars_key_guard on storage.objects as restrictive for insert to public
  with check (bucket_id <> 'pawsup-avatars' or (
    storage.foldername(name) = array[(select auth.uid())]
    and storage.filename(name)
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
  ));
drop policy if exists pawsup_avatars_delete on storage.objects;
create policy pawsup_avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'pawsup-avatars' and (storage.foldername(name))[1] = (select auth.uid()));

notify pgrst, 'reload schema';
commit;
