-- =========================================================
-- KANTOONG ERP — FASE 4A: AI RESEARCH & SECOND BRAIN
-- File: frontend/db/erp-phase4.sql
--
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run, SETELAH
-- erp-foundation.sql, erp-phase2.sql, erp-phase3.sql. Aman diulang.
--
-- Isi:
--   1. ai_events: catatan ANONIM aktivitas asisten AI di toko
--      (bertanya, direkomendasikan, dilihat, dilampirkan, masuk keranjang).
--   2. log_ai_events(): satu-satunya pintu menulis (divalidasi ketat,
--      dibatasi per sesi). Pengunjung TIDAK bisa membaca tabel ini.
--   3. Hanya OWNER (level 5 / tabel owners) yang bisa membaca, untuk
--      menu ERP "Second Brain". Direksi, marketing, & staf tidak bisa.
--   4. Data otomatis dihapus setelah 90 hari.
--
-- PRIVASI (UU PDP 27/2022):
--   - TIDAK ada user_id, nama, email, HP, alamat, IP, atau isi chat.
--   - session_key = kode acak per tab browser (bukan fingerprint), hilang
--     saat tab ditutup.
--   - keywords hanya kata dari katalog / daftar kebutuhan (disaring di
--     browser oleh research.js, dicek lagi di sini: huruf kecil saja).
-- =========================================================

create table if not exists public.ai_events (
    id           bigint generated always as identity primary key,
    at           timestamptz not null default now(),
    business_id  text not null check (char_length(business_id) between 1 and 60),
    session_key  text not null check (session_key ~ '^s-[a-z0-9]{6,24}$'),
    kind         text not null check (kind in ('ask', 'recommend', 'attach', 'view', 'cart')),
    product_id   text check (product_id is null or char_length(product_id) <= 80),
    product_name text check (product_name is null or char_length(product_name) <= 120),
    keywords     text[] not null default '{}' check (cardinality(keywords) <= 5),
    surface      text check (surface is null or surface in ('store', 'product', 'cart', 'dashboard', 'erp'))
);

create index if not exists ai_events_business_at on public.ai_events (business_id, at desc);
create index if not exists ai_events_session on public.ai_events (session_key, at desc);

alter table public.ai_events enable row level security;

-- Baca: HANYA owner (level 5; owner lama di tabel owners juga level 5).
drop policy if exists "erp baca event ai" on public.ai_events;
create policy "erp baca event ai" on public.ai_events for select
    using (public.erp_my_level() >= 5);

-- Tidak ada policy insert/update/delete: tulis HANYA lewat log_ai_events().
revoke insert, update, delete on public.ai_events from anon, authenticated;


-- =========================================================
-- Pintu tulis: log_ai_events(p jsonb) — array berisi maks 20 event.
-- Event yang tidak valid dilewati diam-diam (tidak membocorkan alasan).
-- Batas: 400 event per sesi per hari (mencegah spam).
-- =========================================================
create or replace function public.log_ai_events(p jsonb)
returns int
language plpgsql security definer set search_path = public
as $$
declare
    e         jsonb;
    v_session text;
    v_kind    text;
    v_words   text[];
    v_count   int := 0;
begin
    if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 20 then
        return 0;
    end if;

    for e in select * from jsonb_array_elements(p) loop
        v_session := e ->> 'session_key';
        v_kind := e ->> 'kind';

        continue when v_session is null or v_session !~ '^s-[a-z0-9]{6,24}$';
        continue when v_kind is null or v_kind not in ('ask', 'recommend', 'attach', 'view', 'cart');
        continue when coalesce(e ->> 'business_id', '') !~ '^[A-Za-z0-9_-]{1,60}$';

        -- Batas per sesi per hari.
        continue when (
            select count(*) from public.ai_events
            where session_key = v_session and at > now() - interval '1 day'
        ) >= 400;

        -- Kata kunci: hanya huruf kecil 3-24 karakter, maks 5.
        select coalesce(array_agg(w), '{}') into v_words
        from (
            select w from jsonb_array_elements_text(coalesce(e -> 'keywords', '[]'::jsonb)) as w
            where w ~ '^[a-z]{3,24}$'
            limit 5
        ) k;

        insert into public.ai_events (business_id, session_key, kind, product_id, product_name, keywords, surface)
        values (
            e ->> 'business_id',
            v_session,
            v_kind,
            nullif(left(e ->> 'product_id', 80), ''),
            nullif(left(e ->> 'product_name', 120), ''),
            v_words,
            case when e ->> 'surface' in ('store', 'product', 'cart', 'dashboard', 'erp') then e ->> 'surface' end
        );
        v_count := v_count + 1;
    end loop;

    -- Bersih-bersih sesekali: data lebih dari 90 hari dihapus.
    if random() < 0.02 then
        delete from public.ai_events where at < now() - interval '90 days';
    end if;

    return v_count;
end;
$$;

revoke all on function public.log_ai_events(jsonb) from public;
grant execute on function public.log_ai_events(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
