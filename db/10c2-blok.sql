begin;

-- =====================================================================
-- Hak tulis lorekeeper pada content_blocks
-- (menimpa grant update dari Fase 8; TIDAK ada hak hapus langsung,
--  penghapusan hanya lewat fungsi delete_block)
-- =====================================================================
create policy "lorekeeper menambah blok" on public.content_blocks
  for insert to authenticated
  with check ((select public.is_lorekeeper()));
-- Policy update "lorekeeper mengubah paragraf" dari Fase 8 tetap dipakai

revoke insert, update on public.content_blocks from authenticated;
grant insert (lore_entry_id, body, sort_order, block_type, heading_level)
  on public.content_blocks to authenticated;
grant update (body, sort_order, block_type, heading_level)
  on public.content_blocks to authenticated;

-- =====================================================================
-- Blok yang punya catatan aktif tidak boleh dijadikan heading
-- =====================================================================
create function public.block_type_change_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.block_type = 'heading' and old.block_type <> 'heading' then
    if exists (
      select 1 from public.community_posts p
      where p.content_block_id = new.id
        and p.type = 'note'
        and p.deleted_at is null
        and p.status in ('submitted', 'under_review', 'approved')
    ) then
      raise exception 'Blok ini punya catatan aktif, jadi tidak bisa dijadikan heading';
    end if;
  end if;
  return new;
end;
$$;

create trigger content_blocks_type_guard
  before update of block_type on public.content_blocks
  for each row execute function public.block_type_change_guard();

-- =====================================================================
-- Tambah blok (di awal, setelah blok tertentu, atau di akhir)
-- =====================================================================
create function public.add_block(
  p_entry_id uuid,
  p_after_block_id uuid,
  p_at_start boolean,
  p_block_type text,
  p_heading_level integer,
  p_body text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_pos int;
  v_id uuid;
begin
  if p_at_start then
    v_pos := 1;
  elsif p_after_block_id is null then
    select coalesce(max(sort_order), 0) + 1 into v_pos
    from public.content_blocks
    where lore_entry_id = p_entry_id;
  else
    select sort_order + 1 into v_pos
    from public.content_blocks
    where id = p_after_block_id and lore_entry_id = p_entry_id;

    if v_pos is null then
      raise exception 'Blok acuan tidak ditemukan';
    end if;
  end if;

  -- Geser blok-blok yang berada di posisi sisip atau sesudahnya
  update public.content_blocks
     set sort_order = sort_order + 1
   where lore_entry_id = p_entry_id and sort_order >= v_pos;

  insert into public.content_blocks
    (lore_entry_id, body, sort_order, block_type, heading_level)
  values
    (p_entry_id, p_body, v_pos, p_block_type, p_heading_level::smallint)
  returning id into v_id;

  perform public.log_action(
    'block.create', 'content_block', v_id,
    jsonb_build_object('entry_id', p_entry_id, 'type', p_block_type)
  );

  return v_id;
end;
$$;

-- =====================================================================
-- Geser blok naik / turun (tukar posisi, lalu beri nomor ulang 1..n)
-- =====================================================================
create function public.move_block(p_block_id uuid, p_direction text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_entry uuid;
  v_ids uuid[];
  v_i int;
  v_j int;
  v_tmp uuid;
begin
  select lore_entry_id into v_entry
  from public.content_blocks where id = p_block_id;
  if v_entry is null then
    return;
  end if;

  select array_agg(id order by sort_order, id) into v_ids
  from public.content_blocks
  where lore_entry_id = v_entry;

  v_i := array_position(v_ids, p_block_id);
  v_j := case when p_direction = 'up' then v_i - 1 else v_i + 1 end;

  if v_i is null or v_j < 1 or v_j > array_length(v_ids, 1) then
    return;
  end if;

  v_tmp := v_ids[v_i];
  v_ids[v_i] := v_ids[v_j];
  v_ids[v_j] := v_tmp;

  update public.content_blocks c
     set sort_order = t.pos::int
    from unnest(v_ids) with ordinality as t(block_id, pos)
   where c.id = t.block_id;

  perform public.log_action(
    'block.move', 'content_block', p_block_id,
    jsonb_build_object('direction', p_direction)
  );
end;
$$;

-- =====================================================================
-- Hapus blok: satu-satunya pintu penghapusan, menolak blok yang
-- masih punya catatan aktif
-- =====================================================================
create function public.delete_block(p_block_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry uuid;
  v_active int;
  v_media int;
begin
  if not public.is_lorekeeper() then
    raise exception 'Hanya lorekeeper yang boleh menghapus blok';
  end if;

  select lore_entry_id into v_entry
  from public.content_blocks where id = p_block_id;
  if v_entry is null then
    raise exception 'Blok tidak ditemukan';
  end if;

  select count(*) into v_active
  from public.community_posts p
  where p.content_block_id = p_block_id
    and p.type = 'note'
    and p.deleted_at is null
    and p.status in ('submitted', 'under_review', 'approved');

  if v_active > 0 then
    raise exception 'Blok ini masih punya % catatan aktif. Tolak atau tarik catatannya dulu.', v_active;
  end if;

  select count(*) into v_media
  from public.block_media where content_block_id = p_block_id;

  delete from public.content_blocks where id = p_block_id;

  perform public.log_action(
    'block.delete', 'content_block', p_block_id,
    jsonb_build_object('entry_id', v_entry, 'media_removed', v_media)
  );
end;
$$;

revoke execute on function public.add_block(uuid, uuid, boolean, text, integer, text)
  from public, anon;
revoke execute on function public.move_block(uuid, text) from public, anon;
revoke execute on function public.delete_block(uuid) from public, anon;
grant execute on function public.add_block(uuid, uuid, boolean, text, integer, text)
  to authenticated;
grant execute on function public.move_block(uuid, text) to authenticated;
grant execute on function public.delete_block(uuid) to authenticated;

commit;