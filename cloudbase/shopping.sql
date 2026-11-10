begin;

-- Product IDs match the sample catalog in src/services/products.ts.

create table if not exists public.pawsup_product_favorites (
  owner_id text not null default auth.uid(),
  product_id text not null check (product_id in ('snack', 'toy', 'bed', 'carrier', 'catfood')),
  primary key (owner_id, product_id)
);
alter table public.pawsup_product_favorites enable row level security;
revoke all on public.pawsup_product_favorites from public, anon, authenticated;
revoke all (owner_id, product_id) on public.pawsup_product_favorites from public, anon, authenticated;
grant select, delete on public.pawsup_product_favorites to authenticated;
grant insert (product_id) on public.pawsup_product_favorites to authenticated;

drop policy if exists pawsup_owner on public.pawsup_product_favorites;
create policy pawsup_owner on public.pawsup_product_favorites for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists pawsup_owner_guard on public.pawsup_product_favorites;
create policy pawsup_owner_guard on public.pawsup_product_favorites as restrictive for all to public
  using (current_user = 'authenticated' and owner_id = (select auth.uid()))
  with check (current_user = 'authenticated' and owner_id = (select auth.uid()));

create table if not exists public.pawsup_cart_items (
  owner_id text not null default auth.uid(),
  product_id text not null check (product_id in ('snack', 'toy', 'bed', 'carrier', 'catfood')),
  quantity integer not null check (quantity between 1 and 99),
  primary key (owner_id, product_id)
);
alter table public.pawsup_cart_items enable row level security;
revoke all on public.pawsup_cart_items from public, anon, authenticated;
revoke all (owner_id, product_id, quantity) on public.pawsup_cart_items from public, anon, authenticated;
grant select, delete on public.pawsup_cart_items to authenticated;
grant insert (product_id, quantity) on public.pawsup_cart_items to authenticated;
grant update (product_id, quantity) on public.pawsup_cart_items to authenticated;

drop policy if exists pawsup_owner on public.pawsup_cart_items;
create policy pawsup_owner on public.pawsup_cart_items for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists pawsup_owner_guard on public.pawsup_cart_items;
create policy pawsup_owner_guard on public.pawsup_cart_items as restrictive for all to public
  using (current_user = 'authenticated' and owner_id = (select auth.uid()))
  with check (current_user = 'authenticated' and owner_id = (select auth.uid()));

notify pgrst, 'reload schema';
commit;
