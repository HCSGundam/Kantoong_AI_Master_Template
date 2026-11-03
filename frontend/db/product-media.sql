-- =========================================================
-- KANTOONG CORE — MEDIA POPUP PRODUK (video + galeri varian)
-- File: frontend/db/product-media.sql
--
-- Jalankan SEKALI di Supabase > SQL Editor.
-- Aman dijalankan ulang (pakai "if not exists").
--
-- Kolom baru (diisi owner dari dashboard admin):
-- - video_url : video produk, diputar PERTAMA di popup kartu.
-- - gallery   : daftar foto + nama varian (maks 12), contoh:
--               [{"url": "https://.../coklat.jpg", "label": "Chocolate"},
--                {"url": "https://.../stroberi.jpg", "label": "Frambozen"}]
--               Di popup, foto bergantian seperti tumpukan kartu dan
--               nama varian ikut berganti di tiap foto.
-- =========================================================

-- Foto khusus banner hero (seharusnya sudah ada dari owner-and-pin.sql;
-- ditambahkan lagi di sini untuk database yang dibuat dengan versi lama).
alter table public.products
    add column if not exists hero_image_url text;

alter table public.products
    add column if not exists video_url text
        check (video_url is null or char_length(video_url) <= 500);

alter table public.products
    add column if not exists gallery jsonb
        check (
            gallery is null
            or (jsonb_typeof(gallery) = 'array' and jsonb_array_length(gallery) <= 12)
        );

-- Muat ulang cache skema agar kolom baru langsung dikenali API.
notify pgrst, 'reload schema';
