-- ============================================================
-- KANTOONG — HARGA JUJUR (riwayat harga 30 hari)
-- File: frontend/db/honest-commerce.sql
--
-- Aman dijalankan ulang. Jalankan SETELAH product-card.sql (kolom
-- compare_at_price). Tidak perlu mengulang security-hardening.sql.
--
--   product_price_history: dicatat OTOMATIS oleh trigger setiap kali
--   harga / harga coret produk berubah (tidak bisa ditulis dari web).
--   Toko membaca riwayat ini untuk:
--     - grafik harga 30 hari di halaman produk
--     - harga coret HANYA tampil bila harga itu benar pernah berlaku
--
-- Cerita produk (Cocok / Kurang Cocok, Jejak Asal) memakai tabel
-- product_attributes dari db/industry.sql (jalankan itu juga).
-- ============================================================

create table if not exists public.product_price_history (
    id               bigserial primary key,
    product_id       text not null,
    business_id      text,
    price            numeric not null check (price >= 0),
    compare_at_price numeric check (compare_at_price is null or compare_at_price >= 0),
    changed_at       timestamptz not null default now()
);

create index if not exists product_price_history_product_idx
    on public.product_price_history (product_id, changed_at desc);
create index if not exists product_price_history_business_idx
    on public.product_price_history (business_id);

alter table public.product_price_history enable row level security;

-- Harga memang publik (tampil di toko). Tidak ada kebijakan tulis:
-- hanya trigger (security definer) yang boleh menambah baris.
drop policy if exists "public read price history" on public.product_price_history;
create policy "public read price history" on public.product_price_history
    for select using (true);

grant select on public.product_price_history to anon, authenticated;
revoke insert, update, delete on public.product_price_history from anon, authenticated;
revoke usage, select on sequence public.product_price_history_id_seq from anon, authenticated;

create or replace function public.log_product_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'INSERT'
       or new.price is distinct from old.price
       or new.compare_at_price is distinct from old.compare_at_price then
        insert into public.product_price_history (product_id, business_id, price, compare_at_price)
        values (new.id::text, new.business_id, coalesce(new.price, 0), new.compare_at_price);
    end if;
    return new;
end;
$$;

revoke all on function public.log_product_price() from public, anon, authenticated;

drop trigger if exists products_price_history on public.products;
create trigger products_price_history
    after insert or update of price, compare_at_price on public.products
    for each row execute function public.log_product_price();

-- Titik awal: harga saat ini dicatat SEKARANG (bukan tanggal produk dibuat),
-- supaya tidak mengaku harga sudah berlaku lebih lama dari kenyataannya.
insert into public.product_price_history (product_id, business_id, price, compare_at_price)
select p.id::text, p.business_id, coalesce(p.price, 0), p.compare_at_price
from public.products p
where not exists (
    select 1 from public.product_price_history h where h.product_id = p.id::text
);
