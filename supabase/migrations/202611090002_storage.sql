begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('pet-photos','pet-photos',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('post-images','post-images',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('avatars','avatars',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy media_upload_own on storage.objects for insert to authenticated with check(
 bucket_id in ('pet-photos','post-images','avatars') and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy media_read on storage.objects for select to authenticated using(
 bucket_id in ('pet-photos','post-images','avatars') and (
  (storage.foldername(name))[1]=(select auth.uid())::text
  or (bucket_id='post-images' and exists(select 1 from public.posts p where p.status='published' and name=any(p.image_paths)))
  or (bucket_id='avatars' and exists(select 1 from public.profiles p where p.avatar_path=name))
 )
);
create policy media_update_own on storage.objects for update to authenticated using(
 bucket_id in ('pet-photos','post-images','avatars') and (storage.foldername(name))[1]=(select auth.uid())::text
) with check(
 bucket_id in ('pet-photos','post-images','avatars') and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy media_delete_own on storage.objects for delete to authenticated using(
 bucket_id in ('pet-photos','post-images','avatars') and (storage.foldername(name))[1]=(select auth.uid())::text
);
alter table public.pets add constraint pet_photo_owned_path check(photo_path is null or photo_path like owner_id::text||'/%');
alter table public.profiles add constraint avatar_owned_path check(avatar_path is null or avatar_path like id::text||'/%');
create function public.check_post_image_paths() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from unnest(new.image_paths) path where path is null or path not like new.owner_id::text||'/%') then
  raise exception 'Images must belong to the author' using errcode='23514';
 end if;
 return new;
end $$;
create trigger posts_image_paths before insert or update of image_paths on public.posts for each row execute function public.check_post_image_paths();
revoke all on function public.check_post_image_paths() from public,anon,authenticated;
commit;
