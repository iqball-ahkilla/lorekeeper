begin;

-- Penulis mengedit komentarnya sendiri
create function public.edit_comment(p_post_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

-- Penulis atau lorekeeper menghapus komentar (soft delete)
create function public.delete_comment(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

revoke execute on function public.edit_comment(uuid, text) from public, anon;
revoke execute on function public.delete_comment(uuid) from public, anon;
grant execute on function public.edit_comment(uuid, text) to authenticated;
grant execute on function public.delete_comment(uuid) to authenticated;

commit;