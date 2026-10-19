begin;

create function public.review_note(
  p_post_id uuid,
  p_action text,
  p_reason text default null
)
returns void
language plpgsql
set search_path = ''
as $$
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

revoke execute on function public.review_note(uuid, text, text) from public, anon;
grant execute on function public.review_note(uuid, text, text) to authenticated;

commit;