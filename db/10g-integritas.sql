begin;

create function public.community_post_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create trigger community_posts_guard
  before insert on public.community_posts
  for each row execute function public.community_post_guard();

commit;