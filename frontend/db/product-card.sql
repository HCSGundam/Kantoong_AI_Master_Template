-- =========================================================
-- KANTOONG CORE — DATA TAMBAHAN KARTU PRODUK
-- File: frontend/db/product-card.sql
--
-- Jalankan SEKALI di Supabase > SQL Editor.
-- Aman dijalankan ulang (pakai "if not exists").
--
-- Kolom baru (diisi owner dari dashboard admin):
-- - compare_at_price : harga coret / harga sebelum diskon.
--                      Label "-15%" dihitung otomatis dari sini.
-- - ship_estimate    : estimasi pengiriman, contoh "±1-2 hari".
-- - ship_from        : kota asal kirim, contoh "Jakarta".
--
-- Rating & jumlah terjual TIDAK diisi manual: angkanya harus dari
-- transaksi/ulasan asli agar tidak menyesatkan pembeli.
-- =========================================================

alter table public.products
    add column if not exists compare_at_price numeric
        check (compare_at_price is null or compare_at_price >= 0);

alter table public.products
    add column if not exists ship_estimate text
        check (ship_estimate is null or char_length(ship_estimate) <= 30);

alter table public.products
    add column if not exists ship_from text
        check (ship_from is null or char_length(ship_from) <= 40);

-- Muat ulang cache skema agar kolom baru langsung dikenali API.
notify pgrst, 'reload schema';
