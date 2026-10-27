--
-- PostgreSQL database dump
--

\restrict ecrTyhwXfeqJtyIEZncu0ZtCUjWSIKtz0ECeNly0pzSZpwNMfboRvk2Jd3AXxbS

-- Dumped from database version 17.11
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: add_block(uuid, uuid, boolean, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_block(p_entry_id uuid, p_after_block_id uuid, p_at_start boolean, p_block_type text, p_heading_level integer, p_body text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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


--
-- Name: block_type_change_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_type_change_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: block_visible(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_visible(p_block_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.content_blocks c
    where c.id = p_block_id and public.entry_visible(c.lore_entry_id)
  );
$$;


--
-- Name: community_post_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.community_post_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_parent record;
begin
  -- Hanya boleh menulis ke entry yang terlihat publik (lorekeeper boleh ke mana saja)
  if not public.entry_visible(new.lore_entry_id) and not public.is_lorekeeper() then
    raise exception 'Entry tidak ditemukan';
  end if;

  -- Note harus menempel ke blok milik entry yang sama
  if new.type = 'note' then
    if not exists (
      select 1 from public.content_blocks b
      where b.id = new.content_block_id
        and b.lore_entry_id = new.lore_entry_id
    ) then
      raise exception 'Paragraf tidak valid untuk entry ini';
    end if;
  end if;

  -- Balasan: induk harus ada di entry yang sama, berupa komentar atau note utama,
  -- dan belum dihapus
  if new.parent_id is not null then
    select lore_entry_id, parent_id, deleted_at
      into v_parent
      from public.community_posts
     where id = new.parent_id;

    if not found
       or v_parent.lore_entry_id <> new.lore_entry_id
       or v_parent.parent_id is not null
       or v_parent.deleted_at is not null then
      raise exception 'Komentar yang dibalas tidak valid';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: content_item_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.content_item_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if tg_op = 'UPDATE'
     and new.slug is distinct from old.slug
     and old.first_published_at is not null then
    raise exception 'Slug tidak bisa diubah setelah item pernah diterbitkan';
  end if;

  if new.status = 'published' and new.first_published_at is null then
    new.first_published_at := now();
  end if;

  return new;
end;
$$;


--
-- Name: delete_block(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_block(p_block_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: delete_comment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_comment(p_post_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_author uuid;
  v_by_author boolean;
begin
  if v_uid is null then
    raise exception 'Kamu harus masuk dulu';
  end if;

  select author_id into v_author
  from public.community_posts
  where id = p_post_id and type = 'comment' and deleted_at is null;

  if v_author is null then
    raise exception 'Komentar tidak ditemukan';
  end if;

  v_by_author := (v_author = v_uid);

  if not v_by_author and not public.is_lorekeeper() then
    raise exception 'Kamu tidak boleh menghapus komentar ini';
  end if;

  update public.community_posts
     set body = case
                  when v_by_author then '[komentar dihapus]'
                  else '[komentar dihapus moderator]'
                end,
         deleted_at = now(),
         deleted_by = v_uid
   where id = p_post_id;

  if not v_by_author then
    perform public.log_action(
      'comment.delete', 'comment', p_post_id,
      jsonb_build_object('author_id', v_author)
    );
  end if;
end;
$$;


--
-- Name: delete_impact(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_impact(p_type text, p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
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


--
-- Name: edit_comment(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edit_comment(p_post_id uuid, p_body text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_author uuid;
begin
  if v_uid is null then
    raise exception 'Kamu harus masuk dulu';
  end if;

  if p_body is null or char_length(trim(p_body)) not between 1 and 2000 then
    raise exception 'Komentar harus 1-2000 karakter';
  end if;

  select author_id into v_author
  from public.community_posts
  where id = p_post_id and type = 'comment' and deleted_at is null;

  if v_author is null then
    raise exception 'Komentar tidak ditemukan';
  end if;
  if v_author <> v_uid then
    raise exception 'Kamu hanya bisa mengedit komentarmu sendiri';
  end if;

  update public.community_posts
     set body = trim(p_body),
         edited_at = now(),
         edited_by = v_uid
   where id = p_post_id;
end;
$$;


--
-- Name: edit_note(uuid, text, text, uuid[], jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edit_note(p_post_id uuid, p_body text, p_evidence text, p_keep_ids uuid[], p_new_attachments jsonb) RETURNS text[]
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: entry_visible(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.entry_visible(p_entry_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.lore_entries e
    join public.subsections s on s.id = e.subsection_id
    join public.regions r on r.id = s.region_id
    where e.id = p_entry_id
      and e.status = 'published'
      and s.status = 'published'
      and r.status = 'published'
  );
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_name text := coalesce(new.raw_user_meta_data ->> 'username', '');
begin
  if v_name !~ '^[A-Za-z0-9_]{3,20}$'
     or exists (
       select 1 from public.profiles where lower(username) = lower(v_name)
     ) then
    v_name := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;

  insert into public.profiles (id, username) values (new.id, v_name);
  return new;
end;
$_$;


--
-- Name: is_lorekeeper(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_lorekeeper() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'lorekeeper'
  );
$$;


--
-- Name: limit_note_attachments(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.limit_note_attachments() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if (select count(*) from public.note_attachments where post_id = new.post_id) >= 2 then
    raise exception 'Maksimal 2 lampiran per catatan';
  end if;
  return new;
end;
$$;


--
-- Name: log_action(text, text, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_action(p_action text, p_target_type text, p_target_id uuid DEFAULT NULL::uuid, p_details jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not public.is_lorekeeper() then
    raise exception 'Hanya lorekeeper yang boleh mencatat aksi moderasi';
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (
    (select auth.uid()),
    p_action,
    p_target_type,
    p_target_id,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;


--
-- Name: lore_media_paths(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lore_media_paths(p_type text, p_id uuid) RETURNS text[]
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare
  v text[];
begin
  if p_type = 'block' then
    select coalesce(array_agg(m.media_url), '{}') into v
    from public.block_media m
    where m.content_block_id = p_id and m.media_type = 'image';

  elsif p_type = 'entry' then
    select coalesce(array_agg(m.media_url), '{}') into v
    from public.block_media m
    join public.content_blocks c on c.id = m.content_block_id
    where c.lore_entry_id = p_id and m.media_type = 'image';

  elsif p_type = 'subsection' then
    select coalesce(array_agg(m.media_url), '{}') into v
    from public.block_media m
    join public.content_blocks c on c.id = m.content_block_id
    join public.lore_entries e on e.id = c.lore_entry_id
    where e.subsection_id = p_id and m.media_type = 'image';

  elsif p_type = 'region' then
    select coalesce(array_agg(m.media_url), '{}') into v
    from public.block_media m
    join public.content_blocks c on c.id = m.content_block_id
    join public.lore_entries e on e.id = c.lore_entry_id
    join public.subsections s on s.id = e.subsection_id
    where s.region_id = p_id and m.media_type = 'image';
  end if;

  return coalesce(v, '{}');
end;
$$;


--
-- Name: move_block(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.move_block(p_block_id uuid, p_direction text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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


--
-- Name: note_block_type_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.note_block_type_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if new.type = 'note' and new.content_block_id is not null then
    if not exists (
      select 1 from public.content_blocks b
      where b.id = new.content_block_id
        and b.block_type in ('paragraph', 'quote')
    ) then
      raise exception 'Catatan hanya boleh menempel ke paragraf atau kutipan';
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: region_visible(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.region_visible(p_region_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.regions r
    where r.id = p_region_id and r.status = 'published'
  );
$$;


--
-- Name: review_note(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_note(p_post_id uuid, p_action text, p_reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_status text;
  v_log text;
begin
  if not public.is_lorekeeper() then
    raise exception 'Hanya lorekeeper yang boleh mereview catatan';
  end if;

  select status into v_status
  from public.community_posts
  where id = p_post_id and type = 'note' and deleted_at is null;

  if v_status is null then
    raise exception 'Catatan tidak ditemukan atau sudah ditarik penulisnya';
  end if;

  if p_action = 'start' then
    if v_status <> 'submitted' then
      raise exception 'Hanya catatan baru yang bisa mulai direview';
    end if;

    update public.community_posts
       set status = 'under_review',
           reviewed_by = v_uid,
           review_started_at = now()
     where id = p_post_id;

    v_log := 'note.start_review';

  elsif p_action = 'approve' then
    if v_status <> 'under_review' then
      raise exception 'Catatan harus berstatus under review sebelum disetujui';
    end if;

    update public.community_posts
       set status = 'approved',
           reviewed_by = v_uid,
           reviewed_at = now()
     where id = p_post_id;

    v_log := 'note.approve';

  elsif p_action = 'reject' then
    if v_status not in ('submitted', 'under_review', 'approved') then
      raise exception 'Catatan ini tidak bisa ditolak';
    end if;
    if v_reason is null or char_length(v_reason) < 3 then
      raise exception 'Alasan wajib diisi (minimal 3 karakter)';
    end if;

    update public.community_posts
       set status = 'rejected',
           rejection_reason = v_reason,
           reviewed_by = v_uid,
           reviewed_at = now()
     where id = p_post_id;

    v_log := case when v_status = 'approved' then 'note.revoke' else 'note.reject' end;

  else
    raise exception 'Aksi review tidak dikenal';
  end if;

  perform public.log_action(
    v_log, 'note', p_post_id,
    jsonb_build_object('from', v_status, 'reason', v_reason)
  );
end;
$$;


--
-- Name: submit_note(uuid, uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_note(p_entry_id uuid, p_block_id uuid, p_body text, p_evidence text, p_attachments jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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


--
-- Name: subsection_visible(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.subsection_visible(p_subsection_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.subsections s
    join public.regions r on r.id = s.region_id
    where s.id = p_subsection_id
      and s.status = 'published'
      and r.status = 'published'
  );
$$;


--
-- Name: withdraw_note(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.withdraw_note(p_post_id uuid) RETURNS text[]
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id uuid,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: block_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.block_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_block_id uuid NOT NULL,
    media_type text NOT NULL,
    media_url text NOT NULL,
    caption text,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT block_media_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text])))
);


--
-- Name: community_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lore_entry_id uuid NOT NULL,
    content_block_id uuid,
    parent_id uuid,
    author_id uuid NOT NULL,
    type text NOT NULL,
    body text NOT NULL,
    evidence_text text,
    status text,
    reviewed_by uuid,
    rejection_reason text,
    edited_by uuid,
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    review_started_at timestamp with time zone,
    CONSTRAINT comment_has_no_note_fields CHECK (((type <> 'comment'::text) OR ((status IS NULL) AND (evidence_text IS NULL) AND (rejection_reason IS NULL) AND (content_block_id IS NULL)))),
    CONSTRAINT community_posts_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 2000))),
    CONSTRAINT community_posts_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT community_posts_type_check CHECK ((type = ANY (ARRAY['comment'::text, 'note'::text]))),
    CONSTRAINT note_requires_block_and_status CHECK (((type <> 'note'::text) OR ((content_block_id IS NOT NULL) AND (status IS NOT NULL) AND (parent_id IS NULL)))),
    CONSTRAINT rejected_requires_reason CHECK (((status <> 'rejected'::text) OR (rejection_reason IS NOT NULL)))
);


--
-- Name: content_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lore_entry_id uuid NOT NULL,
    body text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    block_type text DEFAULT 'paragraph'::text NOT NULL,
    heading_level smallint,
    CONSTRAINT content_blocks_block_type_check CHECK ((block_type = ANY (ARRAY['heading'::text, 'paragraph'::text, 'quote'::text]))),
    CONSTRAINT content_blocks_heading_level_check CHECK ((heading_level = ANY (ARRAY[2, 3]))),
    CONSTRAINT heading_level_matches_type CHECK (((block_type = 'heading'::text) = (heading_level IS NOT NULL)))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['member'::text, 'lorekeeper'::text]))),
    CONSTRAINT profiles_username_format CHECK ((username ~ '^[A-Za-z0-9_]{3,20}$'::text))
);


--
-- Name: leaderboard; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.leaderboard WITH (security_invoker='true') AS
 SELECT p.id AS user_id,
    p.username,
    (count(*))::integer AS approved_notes
   FROM (public.community_posts c
     JOIN public.profiles p ON ((p.id = c.author_id)))
  WHERE ((c.type = 'note'::text) AND (c.status = 'approved'::text) AND (c.deleted_at IS NULL))
  GROUP BY p.id, p.username;


--
-- Name: lore_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lore_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subsection_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    first_published_at timestamp with time zone,
    CONSTRAINT lore_entries_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    kind text DEFAULT 'region'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    first_published_at timestamp with time zone,
    CONSTRAINT regions_kind_check CHECK ((kind = ANY (ARRAY['region'::text, 'topic'::text]))),
    CONSTRAINT regions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: subsections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subsections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    region_id uuid NOT NULL,
    name text NOT NULL,
    alt_name text,
    slug text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    first_published_at timestamp with time zone,
    CONSTRAINT subsections_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: link_targets; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.link_targets WITH (security_invoker='true') AS
 SELECT r.slug AS path,
    r.name AS label,
    r.name AS search_text,
    'region'::text AS kind
   FROM public.regions r
UNION ALL
 SELECT ((r.slug || '/'::text) || s.slug) AS path,
    s.name AS label,
    ((s.name || ' '::text) || COALESCE(s.alt_name, ''::text)) AS search_text,
    'subsection'::text AS kind
   FROM (public.subsections s
     JOIN public.regions r ON ((r.id = s.region_id)))
UNION ALL
 SELECT ((((r.slug || '/'::text) || s.slug) || '/'::text) || e.slug) AS path,
    e.title AS label,
    e.title AS search_text,
    'entry'::text AS kind
   FROM ((public.lore_entries e
     JOIN public.subsections s ON ((s.id = e.subsection_id)))
     JOIN public.regions r ON ((r.id = s.region_id)));


--
-- Name: note_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.note_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    file_path text NOT NULL,
    file_name text NOT NULL,
    file_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT note_attachments_file_type_check CHECK ((file_type = ANY (ARRAY['image'::text, 'document'::text])))
);


--
-- Name: note_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.note_votes (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: block_media block_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_media
    ADD CONSTRAINT block_media_pkey PRIMARY KEY (id);


--
-- Name: community_posts community_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_pkey PRIMARY KEY (id);


--
-- Name: content_blocks content_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_blocks
    ADD CONSTRAINT content_blocks_pkey PRIMARY KEY (id);


--
-- Name: lore_entries lore_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lore_entries
    ADD CONSTRAINT lore_entries_pkey PRIMARY KEY (id);


--
-- Name: lore_entries lore_entries_subsection_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lore_entries
    ADD CONSTRAINT lore_entries_subsection_id_slug_key UNIQUE (subsection_id, slug);


--
-- Name: note_attachments note_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_attachments
    ADD CONSTRAINT note_attachments_pkey PRIMARY KEY (id);


--
-- Name: note_votes note_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_votes
    ADD CONSTRAINT note_votes_pkey PRIMARY KEY (post_id, user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: regions regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_pkey PRIMARY KEY (id);


--
-- Name: regions regions_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_slug_key UNIQUE (slug);


--
-- Name: subsections subsections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subsections
    ADD CONSTRAINT subsections_pkey PRIMARY KEY (id);


--
-- Name: subsections subsections_region_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subsections
    ADD CONSTRAINT subsections_region_id_slug_key UNIQUE (region_id, slug);


--
-- Name: audit_log_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_actor_id_idx ON public.audit_log USING btree (actor_id);


--
-- Name: audit_log_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_created_at_idx ON public.audit_log USING btree (created_at DESC);


--
-- Name: block_media_content_block_id_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX block_media_content_block_id_sort_order_idx ON public.block_media USING btree (content_block_id, sort_order);


--
-- Name: community_posts_author_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX community_posts_author_id_idx ON public.community_posts USING btree (author_id);


--
-- Name: community_posts_lore_entry_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX community_posts_lore_entry_id_created_at_idx ON public.community_posts USING btree (lore_entry_id, created_at);


--
-- Name: community_posts_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX community_posts_parent_id_idx ON public.community_posts USING btree (parent_id);


--
-- Name: content_blocks_lore_entry_id_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_blocks_lore_entry_id_sort_order_idx ON public.content_blocks USING btree (lore_entry_id, sort_order);


--
-- Name: lore_entries_subsection_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lore_entries_subsection_id_idx ON public.lore_entries USING btree (subsection_id);


--
-- Name: note_attachments_post_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX note_attachments_post_id_idx ON public.note_attachments USING btree (post_id);


--
-- Name: note_votes_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX note_votes_user_id_idx ON public.note_votes USING btree (user_id);


--
-- Name: subsections_region_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subsections_region_id_idx ON public.subsections USING btree (region_id);


--
-- Name: community_posts community_posts_block_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER community_posts_block_guard BEFORE INSERT OR UPDATE OF content_block_id ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.note_block_type_guard();


--
-- Name: community_posts community_posts_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER community_posts_guard BEFORE INSERT ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.community_post_guard();


--
-- Name: content_blocks content_blocks_type_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER content_blocks_type_guard BEFORE UPDATE OF block_type ON public.content_blocks FOR EACH ROW EXECUTE FUNCTION public.block_type_change_guard();


--
-- Name: lore_entries lore_entries_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lore_entries_guard BEFORE INSERT OR UPDATE ON public.lore_entries FOR EACH ROW EXECUTE FUNCTION public.content_item_guard();


--
-- Name: note_attachments note_attachments_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_attachments_limit BEFORE INSERT ON public.note_attachments FOR EACH ROW EXECUTE FUNCTION public.limit_note_attachments();


--
-- Name: regions regions_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER regions_guard BEFORE INSERT OR UPDATE ON public.regions FOR EACH ROW EXECUTE FUNCTION public.content_item_guard();


--
-- Name: subsections subsections_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER subsections_guard BEFORE INSERT OR UPDATE ON public.subsections FOR EACH ROW EXECUTE FUNCTION public.content_item_guard();


--
-- Name: audit_log audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: block_media block_media_content_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_media
    ADD CONSTRAINT block_media_content_block_id_fkey FOREIGN KEY (content_block_id) REFERENCES public.content_blocks(id) ON DELETE CASCADE;


--
-- Name: community_posts community_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: community_posts community_posts_content_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_content_block_id_fkey FOREIGN KEY (content_block_id) REFERENCES public.content_blocks(id) ON DELETE CASCADE;


--
-- Name: community_posts community_posts_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: community_posts community_posts_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: community_posts community_posts_lore_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_lore_entry_id_fkey FOREIGN KEY (lore_entry_id) REFERENCES public.lore_entries(id) ON DELETE CASCADE;


--
-- Name: community_posts community_posts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.community_posts(id) ON DELETE CASCADE;


--
-- Name: community_posts community_posts_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: content_blocks content_blocks_lore_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_blocks
    ADD CONSTRAINT content_blocks_lore_entry_id_fkey FOREIGN KEY (lore_entry_id) REFERENCES public.lore_entries(id) ON DELETE CASCADE;


--
-- Name: lore_entries lore_entries_subsection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lore_entries
    ADD CONSTRAINT lore_entries_subsection_id_fkey FOREIGN KEY (subsection_id) REFERENCES public.subsections(id) ON DELETE CASCADE;


--
-- Name: note_attachments note_attachments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_attachments
    ADD CONSTRAINT note_attachments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON DELETE CASCADE;


--
-- Name: note_votes note_votes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_votes
    ADD CONSTRAINT note_votes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON DELETE CASCADE;


--
-- Name: note_votes note_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_votes
    ADD CONSTRAINT note_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subsections subsections_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subsections
    ADD CONSTRAINT subsections_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE CASCADE;


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: block_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.block_media ENABLE ROW LEVEL SECURITY;

--
-- Name: community_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: content_blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: content_blocks content_blocks dibaca sesuai status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "content_blocks dibaca sesuai status" ON public.content_blocks FOR SELECT USING ((public.entry_visible(lore_entry_id) OR ( SELECT public.is_lorekeeper() AS is_lorekeeper)));


--
-- Name: note_attachments lampiran dibaca sesuai note; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lampiran dibaca sesuai note" ON public.note_attachments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.community_posts p
  WHERE (p.id = note_attachments.post_id))));


--
-- Name: lore_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lore_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: lore_entries lore_entries dibaca sesuai status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lore_entries dibaca sesuai status" ON public.lore_entries FOR SELECT USING ((((status = 'published'::text) AND public.subsection_visible(subsection_id)) OR ( SELECT public.is_lorekeeper() AS is_lorekeeper)));


--
-- Name: audit_log lorekeeper membaca audit log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper membaca audit log" ON public.audit_log FOR SELECT TO authenticated USING (( SELECT public.is_lorekeeper() AS is_lorekeeper));


--
-- Name: community_posts lorekeeper membaca semua post; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper membaca semua post" ON public.community_posts FOR SELECT TO authenticated USING (( SELECT public.is_lorekeeper() AS is_lorekeeper));


--
-- Name: content_blocks lorekeeper menambah blok; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper menambah blok" ON public.content_blocks FOR INSERT TO authenticated WITH CHECK (( SELECT public.is_lorekeeper() AS is_lorekeeper));


--
-- Name: lore_entries lorekeeper menambah lore_entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper menambah lore_entries" ON public.lore_entries FOR INSERT TO authenticated WITH CHECK (( SELECT public.is_lorekeeper() AS is_lorekeeper));


--
-- Name: regions lorekeeper menambah regions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper menambah regions" ON public.regions FOR INSERT TO authenticated WITH CHECK (( SELECT public.is_lorekeeper() AS is_lorekeeper));


--
-- Name: subsections lorekeeper menambah subsections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper menambah subsections" ON public.subsections FOR INSERT TO authenticated WITH CHECK (( SELECT public.is_lorekeeper() AS is_lorekeeper));


--
-- Name: block_media lorekeeper mengelola media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper mengelola media" ON public.block_media TO authenticated USING (( SELECT public.is_lorekeeper() AS is_lorekeeper)) WITH CHECK (( SELECT public.is_lorekeeper() AS is_lorekeeper));


--
-- Name: community_posts lorekeeper mengelola note; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper mengelola note" ON public.community_posts FOR UPDATE TO authenticated USING ((( SELECT public.is_lorekeeper() AS is_lorekeeper) AND (type = 'note'::text))) WITH CHECK ((( SELECT public.is_lorekeeper() AS is_lorekeeper) AND (type = 'note'::text)));


--
-- Name: lore_entries lorekeeper menghapus lore_entries arsip; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper menghapus lore_entries arsip" ON public.lore_entries FOR DELETE TO authenticated USING ((( SELECT public.is_lorekeeper() AS is_lorekeeper) AND (status = 'archived'::text)));


--
-- Name: regions lorekeeper menghapus regions arsip; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper menghapus regions arsip" ON public.regions FOR DELETE TO authenticated USING ((( SELECT public.is_lorekeeper() AS is_lorekeeper) AND (status = 'archived'::text)));


--
-- Name: subsections lorekeeper menghapus subsections arsip; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper menghapus subsections arsip" ON public.subsections FOR DELETE TO authenticated USING ((( SELECT public.is_lorekeeper() AS is_lorekeeper) AND (status = 'archived'::text)));


--
-- Name: lore_entries lorekeeper mengubah lore_entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper mengubah lore_entries" ON public.lore_entries FOR UPDATE TO authenticated USING (( SELECT public.is_lorekeeper() AS is_lorekeeper)) WITH CHECK (( SELECT public.is_lorekeeper() AS is_lorekeeper));


--
-- Name: content_blocks lorekeeper mengubah paragraf; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper mengubah paragraf" ON public.content_blocks FOR UPDATE TO authenticated USING (( SELECT public.is_lorekeeper() AS is_lorekeeper)) WITH CHECK (( SELECT public.is_lorekeeper() AS is_lorekeeper));


--
-- Name: regions lorekeeper mengubah regions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper mengubah regions" ON public.regions FOR UPDATE TO authenticated USING (( SELECT public.is_lorekeeper() AS is_lorekeeper)) WITH CHECK (( SELECT public.is_lorekeeper() AS is_lorekeeper));


--
-- Name: subsections lorekeeper mengubah subsections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lorekeeper mengubah subsections" ON public.subsections FOR UPDATE TO authenticated USING (( SELECT public.is_lorekeeper() AS is_lorekeeper)) WITH CHECK (( SELECT public.is_lorekeeper() AS is_lorekeeper));


--
-- Name: block_media media dibaca sesuai status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "media dibaca sesuai status" ON public.block_media FOR SELECT USING ((public.block_visible(content_block_id) OR ( SELECT public.is_lorekeeper() AS is_lorekeeper)));


--
-- Name: note_votes member memberi vote; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "member memberi vote" ON public.note_votes FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.community_posts p
  WHERE ((p.id = note_votes.post_id) AND (p.type = 'note'::text) AND (p.deleted_at IS NULL) AND (p.status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'approved'::text])) AND (p.author_id <> ( SELECT auth.uid() AS uid)))))));


--
-- Name: note_votes member menarik votenya; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "member menarik votenya" ON public.note_votes FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: community_posts member menulis post; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "member menulis post" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (((author_id = ( SELECT auth.uid() AS uid)) AND ((type = 'comment'::text) OR ((type = 'note'::text) AND (status = 'submitted'::text)))));


--
-- Name: note_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.note_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: note_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.note_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: community_posts penulis membaca postnya sendiri; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "penulis membaca postnya sendiri" ON public.community_posts FOR SELECT TO authenticated USING ((author_id = ( SELECT auth.uid() AS uid)));


--
-- Name: note_attachments penulis menambah lampiran; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "penulis menambah lampiran" ON public.note_attachments FOR INSERT TO authenticated WITH CHECK (((split_part(file_path, '/'::text, 1) = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM public.community_posts p
  WHERE ((p.id = note_attachments.post_id) AND (p.author_id = ( SELECT auth.uid() AS uid)) AND (p.type = 'note'::text) AND (p.status = 'submitted'::text))))));


--
-- Name: community_posts post dibaca publik; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "post dibaca publik" ON public.community_posts FOR SELECT USING ((public.entry_visible(lore_entry_id) AND ((type = 'comment'::text) OR ((type = 'note'::text) AND (status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'approved'::text]))))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles dibaca publik; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles dibaca publik" ON public.profiles FOR SELECT USING (true);


--
-- Name: regions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

--
-- Name: regions regions dibaca sesuai status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "regions dibaca sesuai status" ON public.regions FOR SELECT USING (((status = 'published'::text) OR ( SELECT public.is_lorekeeper() AS is_lorekeeper)));


--
-- Name: subsections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subsections ENABLE ROW LEVEL SECURITY;

--
-- Name: subsections subsections dibaca sesuai status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "subsections dibaca sesuai status" ON public.subsections FOR SELECT USING ((((status = 'published'::text) AND public.region_visible(region_id)) OR ( SELECT public.is_lorekeeper() AS is_lorekeeper)));


--
-- Name: profiles user mengubah profil sendiri; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user mengubah profil sendiri" ON public.profiles FOR UPDATE TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));


--
-- Name: note_votes vote dibaca publik; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vote dibaca publik" ON public.note_votes FOR SELECT USING (true);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION add_block(p_entry_id uuid, p_after_block_id uuid, p_at_start boolean, p_block_type text, p_heading_level integer, p_body text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_block(p_entry_id uuid, p_after_block_id uuid, p_at_start boolean, p_block_type text, p_heading_level integer, p_body text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_block(p_entry_id uuid, p_after_block_id uuid, p_at_start boolean, p_block_type text, p_heading_level integer, p_body text) TO authenticated;
GRANT ALL ON FUNCTION public.add_block(p_entry_id uuid, p_after_block_id uuid, p_at_start boolean, p_block_type text, p_heading_level integer, p_body text) TO service_role;


--
-- Name: FUNCTION block_type_change_guard(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.block_type_change_guard() TO anon;
GRANT ALL ON FUNCTION public.block_type_change_guard() TO authenticated;
GRANT ALL ON FUNCTION public.block_type_change_guard() TO service_role;


--
-- Name: FUNCTION block_visible(p_block_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.block_visible(p_block_id uuid) TO anon;
GRANT ALL ON FUNCTION public.block_visible(p_block_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.block_visible(p_block_id uuid) TO service_role;


--
-- Name: FUNCTION community_post_guard(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.community_post_guard() TO anon;
GRANT ALL ON FUNCTION public.community_post_guard() TO authenticated;
GRANT ALL ON FUNCTION public.community_post_guard() TO service_role;


--
-- Name: FUNCTION content_item_guard(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.content_item_guard() TO anon;
GRANT ALL ON FUNCTION public.content_item_guard() TO authenticated;
GRANT ALL ON FUNCTION public.content_item_guard() TO service_role;


--
-- Name: FUNCTION delete_block(p_block_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_block(p_block_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_block(p_block_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_block(p_block_id uuid) TO service_role;


--
-- Name: FUNCTION delete_comment(p_post_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_comment(p_post_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_comment(p_post_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_comment(p_post_id uuid) TO service_role;


--
-- Name: FUNCTION delete_impact(p_type text, p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_impact(p_type text, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_impact(p_type text, p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_impact(p_type text, p_id uuid) TO service_role;


--
-- Name: FUNCTION edit_comment(p_post_id uuid, p_body text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.edit_comment(p_post_id uuid, p_body text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.edit_comment(p_post_id uuid, p_body text) TO authenticated;
GRANT ALL ON FUNCTION public.edit_comment(p_post_id uuid, p_body text) TO service_role;


--
-- Name: FUNCTION edit_note(p_post_id uuid, p_body text, p_evidence text, p_keep_ids uuid[], p_new_attachments jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.edit_note(p_post_id uuid, p_body text, p_evidence text, p_keep_ids uuid[], p_new_attachments jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.edit_note(p_post_id uuid, p_body text, p_evidence text, p_keep_ids uuid[], p_new_attachments jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.edit_note(p_post_id uuid, p_body text, p_evidence text, p_keep_ids uuid[], p_new_attachments jsonb) TO service_role;


--
-- Name: FUNCTION entry_visible(p_entry_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.entry_visible(p_entry_id uuid) TO anon;
GRANT ALL ON FUNCTION public.entry_visible(p_entry_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.entry_visible(p_entry_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION is_lorekeeper(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_lorekeeper() TO anon;
GRANT ALL ON FUNCTION public.is_lorekeeper() TO authenticated;
GRANT ALL ON FUNCTION public.is_lorekeeper() TO service_role;


--
-- Name: FUNCTION limit_note_attachments(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.limit_note_attachments() TO anon;
GRANT ALL ON FUNCTION public.limit_note_attachments() TO authenticated;
GRANT ALL ON FUNCTION public.limit_note_attachments() TO service_role;


--
-- Name: FUNCTION log_action(p_action text, p_target_type text, p_target_id uuid, p_details jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.log_action(p_action text, p_target_type text, p_target_id uuid, p_details jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_action(p_action text, p_target_type text, p_target_id uuid, p_details jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.log_action(p_action text, p_target_type text, p_target_id uuid, p_details jsonb) TO service_role;


--
-- Name: FUNCTION lore_media_paths(p_type text, p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lore_media_paths(p_type text, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lore_media_paths(p_type text, p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lore_media_paths(p_type text, p_id uuid) TO service_role;


--
-- Name: FUNCTION move_block(p_block_id uuid, p_direction text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.move_block(p_block_id uuid, p_direction text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.move_block(p_block_id uuid, p_direction text) TO authenticated;
GRANT ALL ON FUNCTION public.move_block(p_block_id uuid, p_direction text) TO service_role;


--
-- Name: FUNCTION note_block_type_guard(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.note_block_type_guard() TO anon;
GRANT ALL ON FUNCTION public.note_block_type_guard() TO authenticated;
GRANT ALL ON FUNCTION public.note_block_type_guard() TO service_role;


--
-- Name: FUNCTION region_visible(p_region_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.region_visible(p_region_id uuid) TO anon;
GRANT ALL ON FUNCTION public.region_visible(p_region_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.region_visible(p_region_id uuid) TO service_role;


--
-- Name: FUNCTION review_note(p_post_id uuid, p_action text, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.review_note(p_post_id uuid, p_action text, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.review_note(p_post_id uuid, p_action text, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.review_note(p_post_id uuid, p_action text, p_reason text) TO service_role;


--
-- Name: FUNCTION submit_note(p_entry_id uuid, p_block_id uuid, p_body text, p_evidence text, p_attachments jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_note(p_entry_id uuid, p_block_id uuid, p_body text, p_evidence text, p_attachments jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_note(p_entry_id uuid, p_block_id uuid, p_body text, p_evidence text, p_attachments jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.submit_note(p_entry_id uuid, p_block_id uuid, p_body text, p_evidence text, p_attachments jsonb) TO service_role;


--
-- Name: FUNCTION subsection_visible(p_subsection_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.subsection_visible(p_subsection_id uuid) TO anon;
GRANT ALL ON FUNCTION public.subsection_visible(p_subsection_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.subsection_visible(p_subsection_id uuid) TO service_role;


--
-- Name: FUNCTION withdraw_note(p_post_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.withdraw_note(p_post_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.withdraw_note(p_post_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.withdraw_note(p_post_id uuid) TO service_role;


--
-- Name: TABLE audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_log TO service_role;
GRANT SELECT ON TABLE public.audit_log TO authenticated;


--
-- Name: TABLE block_media; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.block_media TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.block_media TO authenticated;
GRANT ALL ON TABLE public.block_media TO service_role;


--
-- Name: TABLE community_posts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.community_posts TO anon;
GRANT SELECT,DELETE,MAINTAIN,UPDATE ON TABLE public.community_posts TO authenticated;
GRANT ALL ON TABLE public.community_posts TO service_role;


--
-- Name: COLUMN community_posts.lore_entry_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(lore_entry_id) ON TABLE public.community_posts TO authenticated;


--
-- Name: COLUMN community_posts.content_block_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(content_block_id) ON TABLE public.community_posts TO authenticated;


--
-- Name: COLUMN community_posts.parent_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(parent_id) ON TABLE public.community_posts TO authenticated;


--
-- Name: COLUMN community_posts.author_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(author_id) ON TABLE public.community_posts TO authenticated;


--
-- Name: COLUMN community_posts.type; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(type) ON TABLE public.community_posts TO authenticated;


--
-- Name: COLUMN community_posts.body; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(body),UPDATE(body) ON TABLE public.community_posts TO authenticated;


--
-- Name: COLUMN community_posts.evidence_text; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(evidence_text) ON TABLE public.community_posts TO authenticated;


--
-- Name: COLUMN community_posts.status; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(status),UPDATE(status) ON TABLE public.community_posts TO authenticated;


--
-- Name: COLUMN community_posts.reviewed_by; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(reviewed_by) ON TABLE public.community_posts TO authenticated;


--
-- Name: COLUMN community_posts.rejection_reason; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(rejection_reason) ON TABLE public.community_posts TO authenticated;


--
-- Name: COLUMN community_posts.edited_by; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(edited_by) ON TABLE public.community_posts TO authenticated;


--
-- Name: COLUMN community_posts.edited_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(edited_at) ON TABLE public.community_posts TO authenticated;


--
-- Name: COLUMN community_posts.reviewed_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(reviewed_at) ON TABLE public.community_posts TO authenticated;


--
-- Name: COLUMN community_posts.review_started_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(review_started_at) ON TABLE public.community_posts TO authenticated;


--
-- Name: TABLE content_blocks; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.content_blocks TO anon;
GRANT SELECT,DELETE,MAINTAIN ON TABLE public.content_blocks TO authenticated;
GRANT ALL ON TABLE public.content_blocks TO service_role;


--
-- Name: COLUMN content_blocks.lore_entry_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(lore_entry_id) ON TABLE public.content_blocks TO authenticated;


--
-- Name: COLUMN content_blocks.body; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(body),UPDATE(body) ON TABLE public.content_blocks TO authenticated;


--
-- Name: COLUMN content_blocks.sort_order; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(sort_order),UPDATE(sort_order) ON TABLE public.content_blocks TO authenticated;


--
-- Name: COLUMN content_blocks.block_type; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(block_type),UPDATE(block_type) ON TABLE public.content_blocks TO authenticated;


--
-- Name: COLUMN content_blocks.heading_level; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(heading_level),UPDATE(heading_level) ON TABLE public.content_blocks TO authenticated;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.profiles TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.username; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(username) ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE leaderboard; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.leaderboard TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.leaderboard TO authenticated;
GRANT ALL ON TABLE public.leaderboard TO service_role;


--
-- Name: TABLE lore_entries; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.lore_entries TO anon;
GRANT SELECT,DELETE,MAINTAIN ON TABLE public.lore_entries TO authenticated;
GRANT ALL ON TABLE public.lore_entries TO service_role;


--
-- Name: COLUMN lore_entries.subsection_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(subsection_id) ON TABLE public.lore_entries TO authenticated;


--
-- Name: COLUMN lore_entries.title; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(title),UPDATE(title) ON TABLE public.lore_entries TO authenticated;


--
-- Name: COLUMN lore_entries.slug; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(slug),UPDATE(slug) ON TABLE public.lore_entries TO authenticated;


--
-- Name: COLUMN lore_entries.status; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(status),UPDATE(status) ON TABLE public.lore_entries TO authenticated;


--
-- Name: TABLE regions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.regions TO anon;
GRANT SELECT,DELETE,MAINTAIN ON TABLE public.regions TO authenticated;
GRANT ALL ON TABLE public.regions TO service_role;


--
-- Name: COLUMN regions.name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(name),UPDATE(name) ON TABLE public.regions TO authenticated;


--
-- Name: COLUMN regions.slug; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(slug),UPDATE(slug) ON TABLE public.regions TO authenticated;


--
-- Name: COLUMN regions.description; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(description),UPDATE(description) ON TABLE public.regions TO authenticated;


--
-- Name: COLUMN regions.sort_order; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(sort_order),UPDATE(sort_order) ON TABLE public.regions TO authenticated;


--
-- Name: COLUMN regions.kind; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(kind),UPDATE(kind) ON TABLE public.regions TO authenticated;


--
-- Name: COLUMN regions.status; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(status),UPDATE(status) ON TABLE public.regions TO authenticated;


--
-- Name: TABLE subsections; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.subsections TO anon;
GRANT SELECT,DELETE,MAINTAIN ON TABLE public.subsections TO authenticated;
GRANT ALL ON TABLE public.subsections TO service_role;


--
-- Name: COLUMN subsections.region_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(region_id) ON TABLE public.subsections TO authenticated;


--
-- Name: COLUMN subsections.name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(name),UPDATE(name) ON TABLE public.subsections TO authenticated;


--
-- Name: COLUMN subsections.alt_name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(alt_name),UPDATE(alt_name) ON TABLE public.subsections TO authenticated;


--
-- Name: COLUMN subsections.slug; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(slug),UPDATE(slug) ON TABLE public.subsections TO authenticated;


--
-- Name: COLUMN subsections.sort_order; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(sort_order),UPDATE(sort_order) ON TABLE public.subsections TO authenticated;


--
-- Name: COLUMN subsections.status; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(status),UPDATE(status) ON TABLE public.subsections TO authenticated;


--
-- Name: TABLE link_targets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.link_targets TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.link_targets TO authenticated;
GRANT ALL ON TABLE public.link_targets TO service_role;


--
-- Name: TABLE note_attachments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.note_attachments TO anon;
GRANT SELECT,DELETE,MAINTAIN,UPDATE ON TABLE public.note_attachments TO authenticated;
GRANT ALL ON TABLE public.note_attachments TO service_role;


--
-- Name: COLUMN note_attachments.post_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(post_id) ON TABLE public.note_attachments TO authenticated;


--
-- Name: COLUMN note_attachments.file_path; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(file_path) ON TABLE public.note_attachments TO authenticated;


--
-- Name: COLUMN note_attachments.file_name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(file_name) ON TABLE public.note_attachments TO authenticated;


--
-- Name: COLUMN note_attachments.file_type; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(file_type) ON TABLE public.note_attachments TO authenticated;


--
-- Name: TABLE note_votes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.note_votes TO anon;
GRANT SELECT,DELETE,MAINTAIN,UPDATE ON TABLE public.note_votes TO authenticated;
GRANT ALL ON TABLE public.note_votes TO service_role;


--
-- Name: COLUMN note_votes.post_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(post_id) ON TABLE public.note_votes TO authenticated;


--
-- Name: COLUMN note_votes.user_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(user_id) ON TABLE public.note_votes TO authenticated;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict ecrTyhwXfeqJtyIEZncu0ZtCUjWSIKtz0ECeNly0pzSZpwNMfboRvk2Jd3AXxbS

