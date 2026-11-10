-- ============================================================
-- KANTOONG — ANACHRONOS ANALYSIS (add-on berbayar) + KUNCI ADD-ON
-- File: frontend/db/analysis.sql
--
-- Aman dijalankan ulang. Jalankan SETELAH erp-foundation.sql,
-- erp-phase4.sql (ai_events) dan erp-pos-pro.sql (pos_lost_sales).
--
--   brand_addons : add-on yang dibeli brand. HANYA diisi PUSAT
--                  (Anachronos / SQL Editor pemilik platform) — web klien
--                  tidak bisa mengaktifkan add-on sendiri.
--   Bila add-on 'analysis' aktif: owner/manajer (level 4+) dan divisi
--   yang berhadapan dengan pembeli (sales, marketing, cs) boleh MEMBACA
--   ai_events (anonim) & penjualan hilang kasir. Divisi internal tidak.
--
-- Mengaktifkan add-on untuk satu brand (jalankan di SQL Editor pusat):
--   insert into public.brand_addons (business_id, addon, active, until)
--   values ('master_template_001', 'analysis', true, '2027-11-30')
--   on conflict (business_id, addon) do update set active = excluded.active, until = excluded.until;
-- ============================================================

create table if not exists public.brand_addons (
    business_id text not null,
    addon       text not null check (addon ~ '^[a-z][a-z0-9-]{1,30}$'),
    active      boolean not null default true,
    until       date,
    updated_at  timestamptz not null default now(),
    primary key (business_id, addon)
);

alter table public.brand_addons enable row level security;

-- Anggota ERP boleh MELIHAT add-on brand (untuk menampilkan menu). Tidak ada policy tulis.
drop policy if exists "erp lihat add-on" on public.brand_addons;
create policy "erp lihat add-on" on public.brand_addons
    for select using (public.erp_my_level() >= 1);

grant select on public.brand_addons to authenticated;
revoke insert, update, delete on public.brand_addons from anon, authenticated;
revoke all on public.brand_addons from anon;

create or replace function public.erp_has_addon(p_addon text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.brand_addons
        where addon = p_addon and active
          and (until is null or until >= current_date)
    );
$$;

revoke all on function public.erp_has_addon(text) from public, anon;
grant execute on function public.erp_has_addon(text) to authenticated;

-- Pembaca Anachronos Analysis: owner/manajer + sales/marketing/cs (yang berhadapan dengan pembeli).
create or replace function public.erp_can_read_analysis()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.erp_has_addon('analysis')
       and (public.erp_my_level() >= 4 or public.erp_my_role() in ('sales', 'marketing', 'cs'));
$$;

revoke all on function public.erp_can_read_analysis() from public, anon;
grant execute on function public.erp_can_read_analysis() to authenticated;

drop policy if exists "analysis baca event ai" on public.ai_events;
create policy "analysis baca event ai" on public.ai_events
    for select using (public.erp_can_read_analysis());

drop policy if exists "analysis baca penjualan hilang" on public.pos_lost_sales;
create policy "analysis baca penjualan hilang" on public.pos_lost_sales
    for select using (public.erp_can_read_analysis());
