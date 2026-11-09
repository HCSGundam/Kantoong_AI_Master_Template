-- ============================================================
-- KANTOONG — PENGATURAN ETALASE (nama brand + katalog)
-- File: frontend/db/storefront.sql
--
-- Aman dijalankan ulang. Jalankan SETELAH erp-foundation.sql.
-- Tidak perlu menjalankan ulang security-hardening.sql setelah file ini.
--
-- Isi:
-- PEMBARUAN 9 Nov: tambah bagian "home" & logo -> jalankan ULANG file ini.
--
--   1. Tabel storefront_settings (1 baris per brand, kolom settings jsonb)
--   2. Baca: semua orang (nama brand & susunan katalog memang tampil publik)
--   3. Tulis: HANYA lewat fungsi storefront_save
--        - bagian "brand"   -> hanya OWNER (level 5)
--        - bagian "catalog" & "home" (zona promosi homepage)
--                             -> admin (level 4+) atau peran sales/marketing
--        - bagian "brand" juga menyimpan logo (URL foto di Storage)
--   4. Realtime: perubahan langsung terkirim ke toko & dashboard
-- ============================================================

create table if not exists public.storefront_settings (
    business_id text primary key,
    settings    jsonb not null default '{}'::jsonb,
    updated_at  timestamptz not null default now(),
    updated_by  uuid
);

alter table public.storefront_settings enable row level security;

drop policy if exists "public read storefront" on public.storefront_settings;
create policy "public read storefront" on public.storefront_settings
    for select using (true);

-- Tidak ada policy insert/update/delete: tulis hanya lewat fungsi di bawah.
revoke insert, update, delete on public.storefront_settings from anon, authenticated;
grant select on public.storefront_settings to anon, authenticated;

create or replace function public.storefront_save(p_business_id text, p_section text, p_value jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_level int := public.erp_my_level();
    v_role  text := public.erp_my_role();
begin
    if auth.uid() is null then
        return jsonb_build_object('error', 'Silakan masuk dulu.');
    end if;

    if p_section = 'brand' then
        if v_level < 5 then
            return jsonb_build_object('error', 'Nama brand hanya bisa diubah oleh owner.');
        end if;
    elsif p_section in ('catalog', 'home') then
        if v_level < 4 and v_role not in ('sales', 'marketing') then
            return jsonb_build_object('error', 'Kamu tidak punya izin mengatur katalog & homepage.');
        end if;
    else
        return jsonb_build_object('error', 'Bagian tidak dikenal.');
    end if;

    if p_value is null or jsonb_typeof(p_value) <> 'object' or octet_length(p_value::text) > 120000 then
        return jsonb_build_object('error', 'Isi pengaturan tidak valid.');
    end if;

    insert into public.storefront_settings as s (business_id, settings, updated_at, updated_by)
    values (p_business_id, jsonb_build_object(p_section, p_value), now(), auth.uid())
    on conflict (business_id) do update
        set settings   = coalesce(s.settings, '{}'::jsonb) || jsonb_build_object(p_section, p_value),
            updated_at = now(),
            updated_by = auth.uid();

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.storefront_save(text, text, jsonb) from public, anon;
grant execute on function public.storefront_save(text, text, jsonb) to authenticated;

-- Realtime: kirim perubahan ke toko & dashboard yang sedang terbuka.
do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
           select 1 from pg_publication_tables
           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'storefront_settings'
       ) then
        execute 'alter publication supabase_realtime add table public.storefront_settings';
    end if;
end $$;
