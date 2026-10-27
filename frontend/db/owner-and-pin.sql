-- ============================================================
-- KANTOONG CORE — OWNER, PIN PRODUK, DAN KEAMANAN (RLS)
-- Jalankan SEKALI di Supabase: SQL Editor > New query > Run
-- Aman dijalankan ulang (memakai IF NOT EXISTS / DROP IF EXISTS).
-- ============================================================

-- 1. KOLOM BARU PADA TABEL products ---------------------------
alter table public.products add column if not exists business_id  text    default 'master_template_001';
alter table public.products add column if not exists description  text;
alter table public.products add column if not exists is_featured  boolean not null default false;  -- tampil di "Produk Unggulan"
alter table public.products add column if not exists is_hero      boolean not null default false;  -- tampil di hero slider
alter table public.products add column if not exists hero_caption text;                            -- teks kecil di atas judul hero
alter table public.products add column if not exists hero_text    text;                            -- teks promo di hero
alter table public.products add column if not exists sales_count  integer not null default 0;

-- 2. TABEL OWNER ----------------------------------------------
-- Hanya user yang ID-nya ada di tabel ini yang bisa membuka admin
-- dan mengubah produk.
create table if not exists public.owners (
    user_id    uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

alter table public.owners enable row level security;

drop policy if exists "owner membaca barisnya sendiri" on public.owners;
create policy "owner membaca barisnya sendiri"
    on public.owners for select
    using (auth.uid() = user_id);

-- 3. RLS PRODUK -----------------------------------------------
alter table public.products enable row level security;

drop policy if exists "produk dapat dibaca publik" on public.products;
create policy "produk dapat dibaca publik"
    on public.products for select
    using (true);

drop policy if exists "owner menambah produk" on public.products;
create policy "owner menambah produk"
    on public.products for insert
    with check (exists (select 1 from public.owners o where o.user_id = auth.uid()));

drop policy if exists "owner mengubah produk" on public.products;
create policy "owner mengubah produk"
    on public.products for update
    using      (exists (select 1 from public.owners o where o.user_id = auth.uid()))
    with check (exists (select 1 from public.owners o where o.user_id = auth.uid()));

drop policy if exists "owner menghapus produk" on public.products;
create policy "owner menghapus produk"
    on public.products for delete
    using (exists (select 1 from public.owners o where o.user_id = auth.uid()));

-- 4. STORAGE FOTO PRODUK --------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "foto produk dapat dilihat publik" on storage.objects;
create policy "foto produk dapat dilihat publik"
    on storage.objects for select
    using (bucket_id = 'product-images');

drop policy if exists "owner mengunggah foto produk" on storage.objects;
create policy "owner mengunggah foto produk"
    on storage.objects for insert
    with check (
        bucket_id = 'product-images'
        and exists (select 1 from public.owners o where o.user_id = auth.uid())
    );

drop policy if exists "owner mengubah foto produk" on storage.objects;
create policy "owner mengubah foto produk"
    on storage.objects for update
    using (
        bucket_id = 'product-images'
        and exists (select 1 from public.owners o where o.user_id = auth.uid())
    );

drop policy if exists "owner menghapus foto produk" on storage.objects;
create policy "owner menghapus foto produk"
    on storage.objects for delete
    using (
        bucket_id = 'product-images'
        and exists (select 1 from public.owners o where o.user_id = auth.uid())
    );

-- 5. DAFTARKAN AKUNMU SEBAGAI OWNER ---------------------------
-- Langkah:
--   a) Supabase > Authentication > Users > Add user:
--      isi email + password, centang "Auto Confirm User".
--   b) Ganti email di bawah dengan email itu, lalu jalankan baris ini.
insert into public.owners (user_id)
select id from auth.users where email = 'micken.jobmail@gmail.com'
on conflict (user_id) do nothing;

-- Cek hasil (harus muncul 1 baris):
-- select * from public.owners;

-- CATATAN: bila tabel products punya policy lama yang mengizinkan
-- siapa saja menulis (mis. "Enable insert for all"), HAPUS lewat
-- Authentication > Policies, agar hanya owner yang bisa mengubah produk.
