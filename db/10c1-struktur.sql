begin;

-- =====================================================================
-- Hak tulis lorekeeper pada tabel struktur
-- =====================================================================
create policy "lorekeeper menambah regions" on public.regions
  for insert to authenticated with check ((select public.is_lorekeeper()));
create policy "lorekeeper mengubah regions" on public.regions
  for update to authenticated
  using ((select public.is_lorekeeper()))
  with check ((select public.is_lorekeeper()));
-- Hapus permanen hanya untuk item yang sudah diarsipkan
create policy "lorekeeper menghapus regions arsip" on public.regions
  for delete to authenticated
  using ((select public.is_lorekeeper()) and status = 'archived');

create policy "lorekeeper menambah subsections" on public.subsections
  for insert to authenticated with check ((select public.is_lorekeeper()));
create policy "lorekeeper mengubah subsections" on public.subsections
  for update to authenticated
  using ((select public.is_lorekeeper()))
  with check ((select public.is_lorekeeper()));
create policy "lorekeeper menghapus subsections arsip" on public.subsections
  for delete to authenticated
  using ((select public.is_lorekeeper()) and status = 'archived');

create policy "lorekeeper menambah lore_entries" on public.lore_entries
  for insert to authenticated with check ((select public.is_lorekeeper()));
create policy "lorekeeper mengubah lore_entries" on public.lore_entries
  for update to authenticated
  using ((select public.is_lorekeeper()))
  with check ((select public.is_lorekeeper()));
create policy "lorekeeper menghapus lore_entries arsip" on public.lore_entries
  for delete to authenticated
  using ((select public.is_lorekeeper()) and status = 'archived');

-- Batasi KOLOM yang boleh diisi (first_published_at diurus trigger, bukan klien)
revoke insert, update on public.regions from authenticated;
grant insert (name, slug, description, sort_order, kind, status)
  on public.regions to authenticated;
grant update (name, slug, description, sort_order, kind, status)
  on public.regions to authenticated;

revoke insert, update on public.subsections from authenticated;
grant insert (region_id, name, alt_name, slug, sort_order, status)
  on public.subsections to authenticated;
grant update (name, alt_name, slug, sort_order, status)
  on public.subsections to authenticated;

revoke insert, update on public.lore_entries from authenticated;
grant insert (subsection_id, title, slug, status)
  on public.lore_entries to authenticated;
grant update (title, slug, status)
  on public.lore_entries to authenticated;

-- =====================================================================
-- Ringkasan dampak penghapusan (dipakai di konfirmasi hapus permanen)
-- =====================================================================
create function public.delete_impact(p_type text, p_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.is_lorekeeper() then
    raise exception 'Hanya lorekeeper';
  end if;

  if p_type = 'region' then
    select jsonb_build_object(
      'subsections',
        (select count(*) from public.subsections where region_id = p_id),
      'entries',
        (select count(*) from public.lore_entries e
           join public.subsections s on s.id = e.subsection_id
          where s.region_id = p_id),
      'blocks',
        (select count(*) from public.content_blocks c
           join public.lore_entries e on e.id = c.lore_entry_id
           join public.subsections s on s.id = e.subsection_id
          where s.region_id = p_id),
      'posts',
        (select count(*) from public.community_posts cp
           join public.lore_entries e on e.id = cp.lore_entry_id
           join public.subsections s on s.id = e.subsection_id
          where s.region_id = p_id)
    ) into v;
  elsif p_type = 'subsection' then
    select jsonb_build_object(
      'entries',
        (select count(*) from public.lore_entries where subsection_id = p_id),
      'blocks',
        (select count(*) from public.content_blocks c
           join public.lore_entries e on e.id = c.lore_entry_id
          where e.subsection_id = p_id),
      'posts',
        (select count(*) from public.community_posts cp
           join public.lore_entries e on e.id = cp.lore_entry_id
          where e.subsection_id = p_id)
    ) into v;
  elsif p_type = 'entry' then
    select jsonb_build_object(
      'blocks',
        (select count(*) from public.content_blocks where lore_entry_id = p_id),
      'posts',
        (select count(*) from public.community_posts where lore_entry_id = p_id)
    ) into v;
  end if;

  return coalesce(v, '{}'::jsonb);
end;
$$;

revoke execute on function public.delete_impact(text, uuid) from public, anon;
grant execute on function public.delete_impact(text, uuid) to authenticated;

commit;