-- =========================================================
-- KANTOONG — MEMORI ASISTEN AI LINTAS HALAMAN, BRAND & PERANGKAT
-- File: frontend/db/assistant-memory.sql
--
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run. Aman diulang.
--
-- Untuk pengguna yang LOGIN (Kantoong ID): obrolan dengan asisten
-- disimpan sebagai TEKS di sini, sehingga nyambung di semua web brand
-- (termasuk subdomain berbeda) dan di semua perangkat.
-- Pengguna tamu: memori hanya di browser-nya sendiri.
--
-- PRIVASI (UU PDP 27/2022):
--  - Hanya disimpan bila pengguna MEMILIH "ingat di semua toko Kantoong".
--  - Setiap orang hanya bisa membaca/menghapus memorinya sendiri (RLS).
--  - Staf/owner TIDAK bisa membaca memori pelanggan lewat API ini.
--  - Menu chat "Hapus memori asisten" menghapus baris ini.
--  - Tidak menyimpan file/foto, hanya teks percakapan.
-- =========================================================

create table if not exists public.assistant_memory (
    user_id    uuid primary key references auth.users(id) on delete cascade,
    messages   jsonb not null default '[]'::jsonb
               check (jsonb_typeof(messages) = 'array' and jsonb_array_length(messages) <= 300),
    updated_at timestamptz not null default now()
);

alter table public.assistant_memory enable row level security;

drop policy if exists "memori asisten milik sendiri" on public.assistant_memory;
create policy "memori asisten milik sendiri" on public.assistant_memory
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';
