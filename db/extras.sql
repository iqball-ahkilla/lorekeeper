-- Dijalankan SETELAH schema.sql

-- 1. Membuat profil otomatis saat ada user baru mendaftar
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Bucket Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('lore-media', 'lore-media', true, 2097152,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('evidence', 'evidence', true, 2097152,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- 3. Kebijakan Storage
create policy "lorekeeper mengelola lore-media" on storage.objects
  for all to authenticated
  using (bucket_id = 'lore-media' and (select public.is_lorekeeper()))
  with check (bucket_id = 'lore-media' and (select public.is_lorekeeper()));

create policy "member upload evidence ke foldernya" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "member menghapus evidence miliknya" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );