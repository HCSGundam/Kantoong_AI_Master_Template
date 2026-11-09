-- =========================================================
-- KANTOONG — PENGAMANAN BERLAPIS DATABASE (lintas modul)
-- File: frontend/db/security-hardening.sql
--
-- Jalankan PALING AKHIR, setelah semua file SQL lain (Supabase › SQL Editor › Run).
-- Aman dijalankan ulang. Jalankan ulang juga setiap kali menambah kolom ke tabel products.
--
-- Isi (lihat docs/KEAMANAN.md untuk penjelasan bisnisnya):
--   1. Rahasia acak database (garam hash) — tidak bisa dibaca dari API
--   2. Sidik pengunjung anonim = hash(IP + rahasia + tanggal): untuk pembatas
--      kecepatan TANPA menyimpan IP & TANPA fingerprinting (UU PDP)
--   3. Harga modal (products.cost_price) TIDAK bisa dibaca publik; staf berwenang
--      membacanya lewat erp_product_costs()
--   4. Anti bot: pesanan toko maks 8 / 10 menit per pengunjung, ulasan maks 3 / jam,
--      banjir event AI dibuang diam-diam (melindungi data & Dapur Prediktif)
--   5. Fungsi internal tertutup untuk API; fungsi ERP tidak bisa dipanggil tamu
--   6. Jejak tidak bisa dihapus: audit_log & penjualan kasir hanya bisa ditambah
-- =========================================================

create extension if not exists pgcrypto with schema extensions;


-- ---------------------------------------------------------
-- 1. RAHASIA ACAK DATABASE
-- ---------------------------------------------------------
create table if not exists public.security_secrets (
    name  text primary key,
    value text not null
);
alter table public.security_secrets enable row level security;
-- Tanpa policy & tanpa izin: tidak ada akun API yang bisa membaca.
revoke all on public.security_secrets from anon, authenticated;

insert into public.security_secrets (name, value)
values ('client_salt', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;


-- ---------------------------------------------------------
-- 2. SIDIK PENGUNJUNG (hash harian, tidak bisa dibalik ke IP)
-- ---------------------------------------------------------
create or replace function public.sec_client_hash()
returns text
language sql stable security definer set search_path = public
as $$
    select encode(extensions.digest(
        coalesce(nullif(trim(split_part(coalesce(
            current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
            current_setting('request.headers', true)::json ->> 'x-forwarded-for',
            current_setting('request.headers', true)::json ->> 'x-real-ip',
            ''), ',', 1)), ''), 'tanpa-alamat')
        || '|' || coalesce((select value from public.security_secrets where name = 'client_salt'), '')
        || '|' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'),
        'sha256'), 'hex');
$$;
revoke all on function public.sec_client_hash() from public, anon, authenticated;


-- ---------------------------------------------------------
-- 3. HARGA MODAL TIDAK BISA DIBACA PUBLIK
--    Izin baca diberikan per kolom: semua kolom produk KECUALI cost_price.
--    (Frontend sudah meminta kolom satu per satu, bukan "select *".)
-- ---------------------------------------------------------
revoke select on public.products from anon, authenticated;
do $$
declare
    v_cols text;
begin
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name <> 'cost_price';
    execute format('grant select (%s) on public.products to anon, authenticated', v_cols);
end $$;

create or replace function public.erp_product_costs()
returns table (product_id text, cost_price numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
    if public.erp_me() is null
       or not (public.erp_my_level() >= 3 or public.erp_has_role(array['produk', 'gudang', 'keuangan', 'pembelian'])) then
        return;
    end if;
    return query select p.id::text, p.cost_price::numeric from public.products p;
end;
$$;
revoke all on function public.erp_product_costs() from public, anon;
grant execute on function public.erp_product_costs() to authenticated;


-- ---------------------------------------------------------
-- 4. ANTI BOT: pembatas kecepatan berbasis sidik pengunjung
-- ---------------------------------------------------------

-- 4a. Pesanan toko: maks 8 per 10 menit per pengunjung (bot pesanan palsu).
alter table public.orders add column if not exists client_hash text;
create index if not exists orders_client_hash_idx on public.orders (client_hash, created_at desc);

create or replace function public.sec_orders_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
    new.client_hash := public.sec_client_hash();
    if (select count(*) from public.orders
        where client_hash = new.client_hash and created_at > now() - interval '10 minutes') >= 8 then
        raise exception 'Terlalu banyak pesanan dalam waktu singkat. Coba lagi beberapa menit lagi.';
    end if;
    return new;
end;
$$;
drop trigger if exists sec_orders_guard on public.orders;
create trigger sec_orders_guard before insert on public.orders
    for each row execute function public.sec_orders_guard();

-- 4b. Event AI: banjir dibuang DIAM-DIAM (bot tidak tahu dirinya diblokir).
--     Batas: 1.200 event/menit seluruh toko, 300 event/jam per pengunjung.
alter table public.ai_events add column if not exists client_hash text;
create index if not exists ai_events_at_idx on public.ai_events (at desc);
create index if not exists ai_events_client_idx on public.ai_events (client_hash, at desc);

create or replace function public.sec_ai_events_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
    new.client_hash := public.sec_client_hash();
    if (select count(*) from public.ai_events where at > now() - interval '1 minute') >= 1200 then
        return null;
    end if;
    if (select count(*) from public.ai_events
        where client_hash = new.client_hash and at > now() - interval '1 hour') >= 300 then
        return null;
    end if;
    return new;
end;
$$;
drop trigger if exists sec_ai_events_guard on public.ai_events;
create trigger sec_ai_events_guard before insert on public.ai_events
    for each row execute function public.sec_ai_events_guard();

-- 4c. Ulasan produk (bila sales-and-reviews.sql sudah dijalankan): maks 3 per jam per pengunjung.
do $$
begin
    if to_regclass('public.product_reviews') is null then
        raise notice 'product_reviews belum ada: jalankan sales-and-reviews.sql lalu jalankan file ini lagi.';
        return;
    end if;
    execute 'alter table public.product_reviews add column if not exists client_hash text';
    execute $f$
        create or replace function public.sec_reviews_guard()
        returns trigger
        language plpgsql security definer set search_path = public
        as $body$
        begin
            new.client_hash := public.sec_client_hash();
            if (select count(*) from public.product_reviews
                where client_hash = new.client_hash and created_at > now() - interval '1 hour') >= 3 then
                raise exception 'Terlalu banyak ulasan dalam waktu singkat.';
            end if;
            return new;
        end;
        $body$
    $f$;
    execute 'drop trigger if exists sec_reviews_guard on public.product_reviews';
    execute 'create trigger sec_reviews_guard before insert on public.product_reviews
             for each row execute function public.sec_reviews_guard()';
end $$;

revoke all on function public.sec_orders_guard() from public, anon, authenticated;
revoke all on function public.sec_ai_events_guard() from public, anon, authenticated;


-- ---------------------------------------------------------
-- 5. FUNGSI INTERNAL & ERP TERTUTUP UNTUK API TAMU
-- ---------------------------------------------------------

-- 5a. Fungsi internal (hanya dipanggil fungsi lain di database): tertutup total.
do $$
declare
    v_fn regprocedure;
begin
    for v_fn in
        select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('erp_journal_write', 'erp_pos_approver', 'erp_pos_shift_summary', 'erp_pos_member_json',
                            'erp_pos_ingredient_write', 'erp_pos_pin_left', 'erp_pos_pin_locked', 'erp_sec_guard',
                            'sec_client_hash')
    loop
        execute format('revoke all on function %s from public, anon, authenticated', v_fn);
    end loop;
end $$;

-- 5b. Semua fungsi ERP lain: TAMU (anon) tidak boleh memanggil.
--     Pengecualian = fungsi pembantu aturan akses (dipakai RLS tabel publik) & cek voucher di checkout.
do $$
declare
    v_fn regprocedure;
begin
    for v_fn in
        select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'erp\_%'
          and p.proname not in ('erp_me', 'erp_my_level', 'erp_my_role', 'erp_has_role', 'erp_can_view', 'erp_subtree',
                                'erp_is_admin', 'erp_is_payroll_admin', 'erp_can_manage', 'erp_can_see_ticket',
                                'erp_is_paid', 'erp_check_voucher')
    loop
        execute format('revoke execute on function %s from public, anon', v_fn);
    end loop;
end $$;


-- ---------------------------------------------------------
-- 6. JEJAK TIDAK BISA DIHAPUS (append-only)
--    Lewat API tidak ada yang bisa mengubah/menghapus audit & penjualan kasir.
--    Koreksi penjualan = void (tercatat), bukan hapus.
-- ---------------------------------------------------------
create or replace function public.sec_append_only()
returns trigger
language plpgsql
as $$
begin
    if current_user in ('anon', 'authenticated') then
        raise exception 'Data % tidak boleh diubah/dihapus (jejak audit).', tg_table_name;
    end if;
    return coalesce(new, old);
end;
$$;

drop trigger if exists sec_audit_append_only on public.audit_log;
create trigger sec_audit_append_only before update or delete on public.audit_log
    for each row execute function public.sec_append_only();

drop trigger if exists sec_pos_sales_no_delete on public.pos_sales;
create trigger sec_pos_sales_no_delete before delete on public.pos_sales
    for each row execute function public.sec_append_only();

do $$
begin
    if to_regclass('public.pos_points') is not null then
        execute 'drop trigger if exists sec_points_append_only on public.pos_points';
        execute 'create trigger sec_points_append_only before update or delete on public.pos_points
                 for each row execute function public.sec_append_only()';
    end if;
end $$;

-- Muat ulang cache skema API.
notify pgrst, 'reload schema';
