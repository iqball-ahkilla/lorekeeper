begin;

-- =====================================================================
-- Leaderboard tidak menghitung note yang ditarik
-- =====================================================================
create or replace view public.leaderboard
with (security_invoker = true) as
select
  p.id as user_id,
  p.username,
  count(*)::int as approved_notes
from public.community_posts c
join public.profiles p on p.id = c.author_id
where c.type = 'note'
  and c.status = 'approved'
  and c.deleted_at is null
group by p.id, p.username;

-- =====================================================================
-- Tidak boleh memberi vote pada note yang sudah ditarik
-- =====================================================================
drop policy if exists "member memberi vote" on public.note_votes;
create policy "member memberi vote" on public.note_votes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and p.type = 'note'
        and p.deleted_at is null
        and p.status in ('submitted', 'under_review', 'approved')
        and p.author_id <> (select auth.uid())
    )
  );

-- =====================================================================
-- Ajukan note + lampiran dalam SATU transaksi
-- (berjalan sebagai pemanggil: RLS dan hak kolom tetap berlaku)
-- =====================================================================
create function public.submit_note(
  p_entry_id uuid,
  p_block_id uuid,
  p_body text,
  p_evidence text,
  p_attachments jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_count int := coalesce(jsonb_array_length(p_attachments), 0);
  a jsonb;
begin
  if v_uid is null then
    raise exception 'Kamu harus masuk dulu';
  end if;
  if p_body is null or char_length(trim(p_body)) not between 1 and 2000 then
    raise exception 'Catatan harus 1-2000 karakter';
  end if;
  if char_length(coalesce(trim(p_evidence), '')) > 2000 then
    raise exception 'Bukti teks maksimal 2000 karakter';
  end if;
  if v_count > 2 then
    raise exception 'Maksimal 2 lampiran';
  end if;
  if char_length(coalesce(trim(p_evidence), '')) = 0 and v_count = 0 then
    raise exception 'Bukti wajib: isi teks atau lampirkan minimal satu file';
  end if;

  if not exists (
    select 1 from public.content_blocks b
    where b.id = p_block_id and b.lore_entry_id = p_entry_id
  ) then
    raise exception 'Paragraf tidak valid';
  end if;

  insert into public.community_posts
    (lore_entry_id, content_block_id, author_id, type, status, body, evidence_text)
  values
    (p_entry_id, p_block_id, v_uid, 'note', 'submitted', trim(p_body),
     nullif(trim(coalesce(p_evidence, '')), ''))
  returning id into v_id;

  for a in
    select value from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb))
  loop
    insert into public.note_attachments (post_id, file_path, file_name, file_type)
    values (v_id, a ->> 'path', a ->> 'name', a ->> 'type');
  end loop;

  return v_id;
end;
$$;

-- =====================================================================
-- Penulis mengedit notenya (hanya saat submitted / under_review)
-- Mengembalikan daftar path file lampiran yang dibuang (untuk dibersihkan
-- dari Storage oleh kode aplikasi)
-- =====================================================================
create function public.edit_note(
  p_post_id uuid,
  p_body text,
  p_evidence text,
  p_keep_ids uuid[],
  p_new_attachments jsonb
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_keep_ids uuid[] := coalesce(p_keep_ids, '{}');
  v_new int := coalesce(jsonb_array_length(p_new_attachments), 0);
  v_keep int;
  v_author uuid;
  v_status text;
  v_removed text[];
  a jsonb;
begin
  if v_uid is null then
    raise exception 'Kamu harus masuk dulu';
  end if;
  if p_body is null or char_length(trim(p_body)) not between 1 and 2000 then
    raise exception 'Catatan harus 1-2000 karakter';
  end if;
  if char_length(coalesce(trim(p_evidence), '')) > 2000 then
    raise exception 'Bukti teks maksimal 2000 karakter';
  end if;

  select author_id, status into v_author, v_status
  from public.community_posts
  where id = p_post_id and type = 'note' and deleted_at is null;

  if v_author is null then
    raise exception 'Catatan tidak ditemukan';
  end if;
  if v_author <> v_uid then
    raise exception 'Kamu hanya bisa mengedit catatanmu sendiri';
  end if;
  if v_status not in ('submitted', 'under_review') then
    raise exception 'Catatan yang sudah disetujui atau ditolak tidak bisa diubah';
  end if;

  select count(*) into v_keep
  from public.note_attachments
  where post_id = p_post_id and id = any(v_keep_ids);

  if v_keep + v_new > 2 then
    raise exception 'Maksimal 2 lampiran';
  end if;
  if char_length(coalesce(trim(p_evidence), '')) = 0 and v_keep + v_new = 0 then
    raise exception 'Bukti wajib: isi teks atau lampirkan minimal satu file';
  end if;

  -- Lampiran yang tidak dipertahankan: catat path-nya, lalu hapus barisnya
  select coalesce(array_agg(file_path), '{}') into v_removed
  from public.note_attachments
  where post_id = p_post_id and not (id = any(v_keep_ids));

  delete from public.note_attachments
  where post_id = p_post_id and not (id = any(v_keep_ids));

  -- Lampiran baru: path harus berada di folder milik pengguna ini
  for a in
    select value from jsonb_array_elements(coalesce(p_new_attachments, '[]'::jsonb))
  loop
    if split_part(a ->> 'path', '/', 1) <> v_uid::text then
      raise exception 'Lampiran tidak valid';
    end if;
    insert into public.note_attachments (post_id, file_path, file_name, file_type)
    values (p_post_id, a ->> 'path', a ->> 'name', a ->> 'type');
  end loop;

  -- Kembali ke antrian: review dibatalkan, vote direset
  update public.community_posts
     set body = trim(p_body),
         evidence_text = nullif(trim(coalesce(p_evidence, '')), ''),
         status = 'submitted',
         reviewed_by = null,
         review_started_at = null,
         reviewed_at = null,
         edited_at = now(),
         edited_by = v_uid
   where id = p_post_id;

  delete from public.note_votes where post_id = p_post_id;

  return v_removed;
end;
$$;

-- =====================================================================
-- Penulis menarik notenya (soft delete; hanya saat submitted / under_review)
-- =====================================================================
create function public.withdraw_note(p_post_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_author uuid;
  v_status text;
  v_removed text[];
begin
  if v_uid is null then
    raise exception 'Kamu harus masuk dulu';
  end if;

  select author_id, status into v_author, v_status
  from public.community_posts
  where id = p_post_id and type = 'note' and deleted_at is null;

  if v_author is null then
    raise exception 'Catatan tidak ditemukan';
  end if;
  if v_author <> v_uid then
    raise exception 'Kamu hanya bisa menarik catatanmu sendiri';
  end if;
  if v_status not in ('submitted', 'under_review') then
    raise exception 'Catatan yang sudah disetujui atau ditolak tidak bisa ditarik';
  end if;

  select coalesce(array_agg(file_path), '{}') into v_removed
  from public.note_attachments
  where post_id = p_post_id;

  delete from public.note_attachments where post_id = p_post_id;
  delete from public.note_votes where post_id = p_post_id;

  update public.community_posts
     set body = '[catatan ditarik penulis]',
         evidence_text = null,
         reviewed_by = null,
         review_started_at = null,
         deleted_at = now(),
         deleted_by = v_uid
   where id = p_post_id;

  return v_removed;
end;
$$;

revoke execute on function public.submit_note(uuid, uuid, text, text, jsonb)
  from public, anon;
revoke execute on function public.edit_note(uuid, text, text, uuid[], jsonb)
  from public, anon;
revoke execute on function public.withdraw_note(uuid) from public, anon;
grant execute on function public.submit_note(uuid, uuid, text, text, jsonb)
  to authenticated;
grant execute on function public.edit_note(uuid, text, text, uuid[], jsonb)
  to authenticated;
grant execute on function public.withdraw_note(uuid) to authenticated;

commit;