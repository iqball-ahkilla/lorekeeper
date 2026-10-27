begin;

create function public.lore_media_paths(p_type text, p_id uuid)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
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

revoke execute on function public.lore_media_paths(text, uuid) from public, anon;
grant execute on function public.lore_media_paths(text, uuid) to authenticated;

commit;