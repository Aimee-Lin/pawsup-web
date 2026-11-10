begin;

create table if not exists public.pawsup_pets (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 18),
  species text not null check (species in ('cat', 'dog', 'other')),
  breed text not null default '' check (char_length(breed) <= 30),
  age text not null default '' check (char_length(age) <= 15),
  bio text not null default '' check (char_length(bio) <= 200),
  photo_path text check (photo_path is null or split_part(photo_path, '/', 1) = owner_id)
);
create index if not exists pawsup_pets_owner_id_idx on public.pawsup_pets (owner_id, id);
alter table public.pawsup_pets enable row level security;
revoke all on public.pawsup_pets from public, anon, authenticated;
revoke all (id, owner_id, name, species, breed, age, bio, photo_path)
  on public.pawsup_pets from public, anon, authenticated;
grant select, delete on public.pawsup_pets to authenticated;
grant insert (name, species, breed, age, bio, photo_path),
      update (name, species, breed, age, bio, photo_path)
  on public.pawsup_pets to authenticated;

drop policy if exists pawsup_pets_owner on public.pawsup_pets;
create policy pawsup_pets_owner on public.pawsup_pets
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Restrictive policies also apply when another permissive policy grants access.
drop policy if exists pawsup_pets_owner_guard on public.pawsup_pets;
create policy pawsup_pets_owner_guard on public.pawsup_pets
  as restrictive for all to public
  using (current_user = 'authenticated' and owner_id = (select auth.uid()))
  with check (current_user = 'authenticated' and owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pawsup-pet-photos', 'pawsup-pet-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only protect this application's bucket, including on shared storage tables.
drop policy if exists pawsup_pet_bucket_no_update on storage.buckets;
create policy pawsup_pet_bucket_no_update on storage.buckets
  as restrictive for update to anon, authenticated
  using (id <> 'pawsup-pet-photos')
  with check (id <> 'pawsup-pet-photos');
drop policy if exists pawsup_pet_bucket_no_delete on storage.buckets;
create policy pawsup_pet_bucket_no_delete on storage.buckets
  as restrictive for delete to anon, authenticated
  using (id <> 'pawsup-pet-photos');

drop policy if exists pawsup_pet_photos_owner_guard on storage.objects;
create policy pawsup_pet_photos_owner_guard on storage.objects
  as restrictive for all to public
  using (bucket_id <> 'pawsup-pet-photos' or (
    current_user = 'authenticated'
    and owner_id = (select auth.uid())
    and (storage.foldername(name))[1] = (select auth.uid())
  ))
  with check (bucket_id <> 'pawsup-pet-photos' or (
    current_user = 'authenticated'
    and owner_id = (select auth.uid())
    and (storage.foldername(name))[1] = (select auth.uid())
  ));

-- Photos are replaced with new keys. Block overwrite and moves into or out of this bucket.
drop policy if exists pawsup_pet_photos_no_update on storage.objects;
create policy pawsup_pet_photos_no_update on storage.objects
  as restrictive for update to anon, authenticated
  using (bucket_id <> 'pawsup-pet-photos')
  with check (bucket_id <> 'pawsup-pet-photos');

drop policy if exists pawsup_pet_photos_read on storage.objects;
create policy pawsup_pet_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'pawsup-pet-photos' and (storage.foldername(name))[1] = (select auth.uid()));
drop policy if exists pawsup_pet_photos_insert on storage.objects;
create policy pawsup_pet_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'pawsup-pet-photos' and (storage.foldername(name))[1] = (select auth.uid()));
drop policy if exists pawsup_pet_photos_delete on storage.objects;
create policy pawsup_pet_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'pawsup-pet-photos' and (storage.foldername(name))[1] = (select auth.uid()));

notify pgrst, 'reload schema';
commit;
