-- =========================================================
-- KANTOONG ERP — PENGUATAN KEAMANAN & EDITOR PRODUK DI ERP
-- File: frontend/db/erp-security.sql
--
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run,
-- SETELAH erp-foundation.sql dan erp-phase2.sql. Aman diulang.
--
-- 1. Akun hanya tersambung ke data karyawan bila EMAIL-NYA SUDAH
--    TERVERIFIKASI. Orang yang mendaftar memakai email karyawan lain
--    (tanpa bisa membuka inbox-nya) tidak akan pernah tersambung.
-- 2. Editor produk pindah ke ERP: owner, direktur, dan staf katalog
--    boleh menambah produk & mengunggah foto; menghapus hanya
--    owner/direktur.
-- =========================================================


-- ---------------------------------------------------------
-- 1. Sambungkan akun -> anggota hanya bila email terverifikasi
-- ---------------------------------------------------------
create or replace function public.erp_link_me()
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
    v_email     text := lower(coalesce(auth.jwt() ->> 'email', ''));
    v_confirmed boolean;
    v_id        uuid;
begin
    if auth.uid() is null or v_email = '' then
        return null;
    end if;

    select u.email_confirmed_at is not null into v_confirmed
      from auth.users u where u.id = auth.uid();

    -- Sudah tersambung sebelumnya: langsung pakai.
    select id into v_id from public.members where user_id = auth.uid() and is_active limit 1;
    if v_id is not null then
        return v_id;
    end if;

    if not coalesce(v_confirmed, false) then
        return null;
    end if;

    update public.members
       set user_id = auth.uid()
     where lower(email) = v_email and user_id is null and is_active
     returning id into v_id;

    -- Owner lama otomatis punya kartu anggota level 5.
    if v_id is null
       and exists (select 1 from public.owners o where o.user_id = auth.uid()) then
        insert into public.members (user_id, email, full_name, position_title, level, job_role)
        values (auth.uid(), v_email, split_part(v_email, '@', 1), 'Owner', 5, 'umum')
        on conflict (email) do nothing
        returning id into v_id;
    end if;

    return v_id;
end;
$$;

revoke all on function public.erp_link_me() from public;
grant execute on function public.erp_link_me() to authenticated;


-- ---------------------------------------------------------
-- 2. Produk: tambah (owner/direktur/staf katalog), hapus (owner/direktur)
-- ---------------------------------------------------------
drop policy if exists "erp katalog tambah produk" on public.products;
create policy "erp katalog tambah produk" on public.products
    for insert with check (public.erp_my_level() >= 4 or public.erp_my_role() = 'produk');

drop policy if exists "erp katalog hapus produk" on public.products;
create policy "erp katalog hapus produk" on public.products
    for delete using (public.erp_my_level() >= 4);


-- ---------------------------------------------------------
-- 3. Foto produk: unggah/ubah dari ERP
-- ---------------------------------------------------------
drop policy if exists "erp katalog unggah foto" on storage.objects;
create policy "erp katalog unggah foto" on storage.objects
    for insert with check (
        bucket_id = 'product-images'
        and (public.erp_my_level() >= 4 or public.erp_my_role() = 'produk')
    );

drop policy if exists "erp katalog ubah foto" on storage.objects;
create policy "erp katalog ubah foto" on storage.objects
    for update using (
        bucket_id = 'product-images'
        and (public.erp_my_level() >= 4 or public.erp_my_role() = 'produk')
    );

notify pgrst, 'reload schema';

-- =========================================================
-- SARAN PENGATURAN SUPABASE (Authentication > Sign In / Providers > Email):
--  - "Confirm email" = ON  -> pendaftar wajib klik link di inbox-nya.
--  Akun karyawan tetap dibuat owner/HR lewat Authentication > Users
--  dengan "Auto Confirm User".
-- =========================================================
