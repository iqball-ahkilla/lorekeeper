begin;

-- 1. Tabel uji dari Fase 0
drop table if exists public.hello;

-- 2. Pengunjung (anon) tidak pernah menulis di aplikasi ini: cabut hak tulisnya
--    sebagai lapisan pengaman kedua di bawah RLS
revoke insert, update, delete, truncate on all tables in schema public from anon;

-- 3. Hak yang tidak pernah dipakai aplikasi (TRUNCATE tidak tunduk pada RLS)
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- 4. Format username dijaga database, apa pun cara pendaftarannya
--    (NOT VALID: hanya berlaku untuk baris baru; data lama divalidasi terpisah)
alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[A-Za-z0-9_]{3,20}$') not valid;

-- 5. Pembuat profil otomatis: username tidak sah atau sudah dipakai
--    diganti nama cadangan, bukan membuat pendaftaran gagal
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

commit;