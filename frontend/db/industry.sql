-- ============================================================
-- KANTOONG — SPESIFIKASI PRODUK PER INDUSTRI (properti, emas, dll.)
-- File: frontend/db/industry.sql
--
-- Aman dijalankan ulang. Jalankan SETELAH erp-foundation.sql.
-- Tidak mengubah tabel products (jadi security-hardening.sql tidak perlu diulang).
--
--   product_attributes: 1 baris per produk, kolom attributes (jsonb)
--     contoh properti: {"lt":120,"lb":90,"kt":3,"km":2,"sertifikat":"SHM","lokasi":"Bintaro"}
--     contoh emas:     {"kadar":"24K","berat":2.5,"ongkos":150000,"jenis":"Cincin"}
--   Baca: publik (memang tampil di toko). Tulis: staf ERP (level 4+ atau peran produk/sales/marketing).
-- ============================================================

create table if not exists public.product_attributes (
    product_id  text primary key,
    business_id text not null,
    attributes  jsonb not null default '{}'::jsonb check (octet_length(attributes::text) <= 8000),
    updated_at  timestamptz not null default now()
);

create index if not exists product_attributes_business_idx on public.product_attributes (business_id);

alter table public.product_attributes enable row level security;

drop policy if exists "public read product attributes" on public.product_attributes;
create policy "public read product attributes" on public.product_attributes
    for select using (true);

drop policy if exists "staff write product attributes" on public.product_attributes;
create policy "staff write product attributes" on public.product_attributes
    for all
    using (public.erp_my_level() >= 4 or public.erp_my_role() in ('produk', 'sales', 'marketing'))
    with check (public.erp_my_level() >= 4 or public.erp_my_role() in ('produk', 'sales', 'marketing'));

grant select on public.product_attributes to anon, authenticated;
grant insert, update, delete on public.product_attributes to authenticated;
revoke insert, update, delete on public.product_attributes from anon;
