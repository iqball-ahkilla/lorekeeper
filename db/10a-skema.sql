begin;

-- =====================================================================
-- 1. Wilayah / Topik
-- =====================================================================
alter table public.regions
  add column kind text not null default 'region'
    check (kind in ('region', 'topic'));

-- =====================================================================
-- 2. Status terbit (draft / published / archived)
--    Data yang sudah ada otomatis "published"; data BARU bawaannya "draft"
-- =====================================================================
alter table public.regions
  add column status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  add column first_published_at timestamptz;

alter table public.subsections
  add column status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  add column first_published_at timestamptz;

alter table public.lore_entries
  add column status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  add column first_published_at timestamptz;

update public.regions set first_published_at = now();
update public.subsections set first_published_at = now();
update public.lore_entries set first_published_at = now();

alter table public.regions alter column status set default 'draft';
alter table public.subsections alter column status set default 'draft';
alter table public.lore_entries alter column status set default 'draft';

-- =====================================================================
-- 3. Tipe blok
-- =====================================================================
alter table public.content_blocks
  add column block_type text not null default 'paragraph'
    check (block_type in ('heading', 'paragraph', 'quote')),
  add column heading_level smallint check (heading_level in (2, 3)),
  add constraint heading_level_matches_type
    check ((block_type = 'heading') = (heading_level is not null));

-- =====================================================================
-- 4. Kolom baru di community_posts
-- =====================================================================
alter table public.community_posts
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id) on delete set null,
  add column review_started_at timestamptz;

grant update (review_started_at) on public.community_posts to authenticated;

-- =====================================================================
-- 5. Audit log: hanya bisa ditulis lewat fungsi log_action
-- =====================================================================
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on public.audit_log (created_at desc);
create index on public.audit_log (actor_id);

alter table public.audit_log enable row level security;

create policy "lorekeeper membaca audit log" on public.audit_log
  for select to authenticated
  using ((select public.is_lorekeeper()));

-- Tidak ada policy insert/update/delete: catatan hanya bisa bertambah lewat fungsi
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create function public.log_action(
  p_action text,
  p_target_type text,
  p_target_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

revoke execute on function public.log_action(text, text, uuid, jsonb) from public, anon;
grant execute on function public.log_action(text, text, uuid, jsonb) to authenticated;

-- =====================================================================
-- 6. Fungsi pembantu: apakah sebuah item terlihat publik?
--    (item terbit DAN semua induknya terbit: arsip berantai)
-- =====================================================================
create function public.region_visible(p_region_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.regions r
    where r.id = p_region_id and r.status = 'published'
  );
$$;

create function public.subsection_visible(p_subsection_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.subsections s
    join public.regions r on r.id = s.region_id
    where s.id = p_subsection_id
      and s.status = 'published'
      and r.status = 'published'
  );
$$;

create function public.entry_visible(p_entry_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
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

create function public.block_visible(p_block_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.content_blocks c
    where c.id = p_block_id and public.entry_visible(c.lore_entry_id)
  );
$$;

-- =====================================================================
-- 7. Aturan baca ditulis ulang: publik hanya melihat yang terbit
--    Lorekeeper melihat semuanya
-- =====================================================================
drop policy if exists "regions dibaca publik" on public.regions;
create policy "regions dibaca sesuai status" on public.regions
  for select using (
    status = 'published' or (select public.is_lorekeeper())
  );

drop policy if exists "subsections dibaca publik" on public.subsections;
create policy "subsections dibaca sesuai status" on public.subsections
  for select using (
    (status = 'published' and public.region_visible(region_id))
    or (select public.is_lorekeeper())
  );

drop policy if exists "lore_entries dibaca publik" on public.lore_entries;
create policy "lore_entries dibaca sesuai status" on public.lore_entries
  for select using (
    (status = 'published' and public.subsection_visible(subsection_id))
    or (select public.is_lorekeeper())
  );

drop policy if exists "content_blocks dibaca publik" on public.content_blocks;
create policy "content_blocks dibaca sesuai status" on public.content_blocks
  for select using (
    public.entry_visible(lore_entry_id) or (select public.is_lorekeeper())
  );

drop policy if exists "media dibaca publik" on public.block_media;
create policy "media dibaca sesuai status" on public.block_media
  for select using (
    public.block_visible(content_block_id) or (select public.is_lorekeeper())
  );

-- Komentar dan note pada konten yang tersembunyi ikut tersembunyi dari publik
drop policy if exists "post dibaca publik" on public.community_posts;
create policy "post dibaca publik" on public.community_posts
  for select using (
    public.entry_visible(lore_entry_id)
    and (
      type = 'comment'
      or (type = 'note' and status in ('submitted', 'under_review', 'approved'))
    )
  );

-- =====================================================================
-- 8. Trigger penjaga
-- =====================================================================

-- a) Slug terkunci setelah item pernah terbit; first_published_at terisi otomatis
create function public.content_item_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
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

create trigger regions_guard
  before insert or update on public.regions
  for each row execute function public.content_item_guard();

create trigger subsections_guard
  before insert or update on public.subsections
  for each row execute function public.content_item_guard();

create trigger lore_entries_guard
  before insert or update on public.lore_entries
  for each row execute function public.content_item_guard();

-- b) Note hanya boleh menempel ke blok paragraf atau quote, bukan heading
create function public.note_block_type_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create trigger community_posts_block_guard
  before insert or update of content_block_id on public.community_posts
  for each row execute function public.note_block_type_guard();

commit; 