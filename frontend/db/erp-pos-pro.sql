-- =========================================================
-- KANTOONG ERP — KASIR POS PRO, TAHAP 1 – 6
-- File: frontend/db/erp-pos-pro.sql
--
-- Jalankan SETELAH erp-phase2.sql (Supabase › SQL Editor › Run).
-- Aman dijalankan ulang.
--
-- Isi:
--   1. Akun baru: Utang pajak (PB1) & Pendapatan service charge
--   2. Pengaturan kasir per outlet (pajak, service, pembulatan, harga ojol, struk)
--   3. Varian & tambahan (ukuran, level gula, topping berbayar, ...)
--   4. Bill terbuka (pesan dulu, bayar nanti)
--   5. Kolom baru penjualan kasir (channel, meja, pajak, service, bayar campuran)
--   6. erp_pos_checkout_v2: harga, varian, pajak, service, pembulatan,
--      bayar campuran, stok & jurnal — SEMUA dihitung di database.
--      Rumusnya sama dengan frontend/erp/core/pos-pro.js.
--   7. TAHAP 2: peran Dapur & Bar, nomor antrian harian, tiket dapur/bar,
--      penjualan yang hilang, minat chat AI (anonim) untuk Dapur Prediktif.
--   8. TAHAP 3: PIN atasan (bcrypt), shift kasir + kas masuk/keluar, tutup
--      shift buta, void ber-PIN (stok kembali + jurnal balik), diskon besar
--      ber-PIN, jualan wajib shift aktif.
--   9. TAHAP 4: member (izin UU PDP, bisa dihapus), buku besar poin (siap
--      lintas brand: ada business_id), promo otomatis (jam hemat & paket hemat).
--      Promo & poin dihitung di erp_pos_checkout_v2 (rumus = core/promo.js & loyalty.js).
--  10. TAHAP 5: bahan baku per outlet, resep menu + resep varian, gerak bahan
--      (pakai/void/beli/buang/hitung stok), HPP di struk & jurnal. Menu ber-resep
--      TIDAK memakai stok barang jadi. Rumus pemakaian = core/recipe.js.
--  11. TAHAP 6: rating pelanggan 1 ketukan (layar pelanggan), transaksi offline
--      disinkron dengan jam aslinya (maks 48 jam) untuk harga promo & laporan.
--  12. Permintaan restok dari kasir (menu habis) -> gudang/owner; selesai otomatis
--      saat belanja bahannya dicatat.
-- =========================================================


-- ---------------------------------------------------------
-- 1. AKUN
-- ---------------------------------------------------------
insert into public.accounts (code, name, type) values
    ('2-1200', 'Utang pajak (PB1)', 'kewajiban'),
    ('4-1200', 'Pendapatan service charge', 'pendapatan')
on conflict (code) do nothing;


-- ---------------------------------------------------------
-- 2. PENGATURAN KASIR PER OUTLET
-- ---------------------------------------------------------
create table if not exists public.pos_settings (
    outlet_id  uuid primary key references public.warehouses(id) on delete cascade,
    settings   jsonb not null default '{}'::jsonb,
    updated_by uuid references public.members(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table public.pos_settings enable row level security;

drop policy if exists "erp baca pengaturan kasir" on public.pos_settings;
create policy "erp baca pengaturan kasir" on public.pos_settings for select
    using (public.erp_me() is not null);
-- Tidak ada policy tulis: hanya lewat erp_pos_save_settings (owner & manajer).

create or replace function public.erp_pos_save_settings(p_outlet uuid, p_settings jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_clean jsonb;
begin
    if public.erp_me() is null or public.erp_my_level() < 4 then
        raise exception 'Akses ditolak: hanya owner/manajer yang boleh mengubah pajak & service.';
    end if;

    if not exists (select 1 from public.warehouses where id = p_outlet and kind = 'outlet') then
        raise exception 'Outlet tidak ditemukan.';
    end if;

    v_clean := jsonb_build_object(
        'service_enabled', coalesce((p_settings ->> 'service_enabled')::boolean, true),
        'service_rate',    least(greatest(coalesce((p_settings ->> 'service_rate')::numeric, 5), 0), 30),
        'tax_enabled',     coalesce((p_settings ->> 'tax_enabled')::boolean, true),
        'tax_rate',        least(greatest(coalesce((p_settings ->> 'tax_rate')::numeric, 10), 0), 30),
        'rounding',        case when (p_settings ->> 'rounding')::int in (0, 100, 500, 1000) then (p_settings ->> 'rounding')::int else 100 end,
        'online_markup',   least(greatest(coalesce((p_settings ->> 'online_markup')::numeric, 20), 0), 100),
        'paper',           case when (p_settings ->> 'paper')::int = 80 then 80 else 58 end,
        'footer',          left(coalesce(p_settings ->> 'footer', 'Terima kasih, sampai jumpa lagi!'), 80),
        'kitchen_enabled', coalesce((p_settings ->> 'kitchen_enabled')::boolean, true),
        'bar_staff',       least(greatest(coalesce((p_settings ->> 'bar_staff')::int, 1), 1), 10),
        'dapur_staff',     least(greatest(coalesce((p_settings ->> 'dapur_staff')::int, 1), 1), 10),
        'discount_pin_percent', least(greatest(coalesce((p_settings ->> 'discount_pin_percent')::numeric, 20), 0), 100)
    );

    insert into public.pos_settings (outlet_id, settings, updated_by, updated_at)
    values (p_outlet, v_clean, public.erp_me(), now())
    on conflict (outlet_id) do update
        set settings = excluded.settings, updated_by = excluded.updated_by, updated_at = now();

    return v_clean;
end;
$$;

revoke all on function public.erp_pos_save_settings(uuid, jsonb) from public;
grant execute on function public.erp_pos_save_settings(uuid, jsonb) to authenticated;


-- ---------------------------------------------------------
-- 3. VARIAN & TAMBAHAN
-- options: [{ "id": "large", "name": "Large", "price": 5000 }, ...]
-- ---------------------------------------------------------
create table if not exists public.pos_modifier_groups (
    id          uuid primary key default gen_random_uuid(),
    name        text not null check (char_length(name) between 1 and 40),
    required    boolean not null default false,
    max_select  int not null default 1 check (max_select between 1 and 10),
    options     jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
    applies_all boolean not null default false,
    product_ids text[] not null default '{}',
    categories  text[] not null default '{}',
    sort        int not null default 0,
    is_active   boolean not null default true,
    updated_at  timestamptz not null default now()
);

alter table public.pos_modifier_groups enable row level security;

drop policy if exists "erp baca varian" on public.pos_modifier_groups;
create policy "erp baca varian" on public.pos_modifier_groups for select
    using (public.erp_me() is not null);

drop policy if exists "erp kelola varian" on public.pos_modifier_groups;
create policy "erp kelola varian" on public.pos_modifier_groups for all
    using (public.erp_has_role(array['produk']))
    with check (public.erp_has_role(array['produk']));


-- ---------------------------------------------------------
-- 4. BILL TERBUKA (pesan dulu, bayar nanti)
-- ---------------------------------------------------------
create table if not exists public.pos_open_bills (
    id            uuid primary key default gen_random_uuid(),
    outlet_id     uuid not null references public.warehouses(id) on delete cascade,
    channel       text not null default 'dine_in'
                  check (channel in ('dine_in', 'take_away', 'delivery', 'gofood', 'grabfood', 'shopeefood')),
    table_no      text not null default '' check (char_length(table_no) <= 10),
    customer_name text not null default '' check (char_length(customer_name) <= 40),
    discount      numeric(14, 0) not null default 0 check (discount >= 0),
    lines         jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 200),
    created_by    uuid references public.members(id) on delete set null default public.erp_me(),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    constraint pos_open_bills_label check (table_no <> '' or customer_name <> '')
);

create index if not exists pos_open_bills_outlet_idx on public.pos_open_bills (outlet_id, updated_at);

-- Tahap 2: nomor antrian & baris yang sudah dikirim ke dapur (kirim tambahan saja).
alter table public.pos_open_bills add column if not exists queue_no text not null default '';
alter table public.pos_open_bills add column if not exists sent     jsonb not null default '{}'::jsonb;

alter table public.pos_open_bills enable row level security;

drop policy if exists "erp kasir kelola bill" on public.pos_open_bills;
create policy "erp kasir kelola bill" on public.pos_open_bills for all
    using (public.erp_has_role(array['kasir']))
    with check (public.erp_has_role(array['kasir']));


-- ---------------------------------------------------------
-- 5. KOLOM BARU PENJUALAN KASIR
-- ---------------------------------------------------------
alter table public.pos_sales add column if not exists channel       text not null default 'dine_in';
alter table public.pos_sales add column if not exists table_no      text not null default '';
alter table public.pos_sales add column if not exists customer_name text not null default '';
alter table public.pos_sales add column if not exists service       numeric(14, 0) not null default 0;
alter table public.pos_sales add column if not exists tax           numeric(14, 0) not null default 0;
alter table public.pos_sales add column if not exists rounding      numeric(14, 0) not null default 0;
alter table public.pos_sales add column if not exists payments      jsonb not null default '[]'::jsonb;
alter table public.pos_sales add column if not exists queue_no      text not null default '';

alter table public.pos_sales drop constraint if exists pos_sales_method_check;
alter table public.pos_sales add constraint pos_sales_method_check
    check (method in ('tunai', 'qris', 'debit', 'kredit', 'transfer', 'ewallet', 'campuran'));


-- ---------------------------------------------------------
-- 6. BAYAR (versi Pro)
-- p: { outlet_id, channel, table_no, customer_name, discount, bill_id, queue_no,
--      lines: [{ product_id, qty, options: [{ group_id, option_id }], note }],
--      payments: [{ method, amount }] }
-- ---------------------------------------------------------
create or replace function public.erp_pos_checkout_v2(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_me        uuid := public.erp_me();
    v_outlet    uuid := (p ->> 'outlet_id')::uuid;
    v_channel   text := coalesce(nullif(p ->> 'channel', ''), 'dine_in');
    v_set       jsonb;
    v_markup    numeric;
    v_round     int;
    v_line      jsonb;
    v_pick      jsonb;
    v_opt       jsonb;
    v_group     public.pos_modifier_groups%rowtype;
    v_pid       text;
    v_qty       int;
    v_name      text;
    v_price     numeric;
    v_category  text;
    v_unit      numeric;
    v_opts      jsonb;
    v_items     jsonb := '[]'::jsonb;
    v_subtotal  numeric := 0;
    v_discount  numeric;
    v_base      numeric;
    v_service   numeric := 0;
    v_tax       numeric := 0;
    v_raw       numeric;
    v_total     numeric;
    v_noncash   numeric;
    v_cash      numeric;
    v_needed    numeric;
    v_change    numeric;
    v_applied   jsonb;
    v_method    text;
    v_receipt   text;
    v_journal   jsonb;
    v_bank      numeric;
    v_revenue   numeric;
    v_shift     uuid;
    v_approver  uuid;
    -- Tahap 4: member, poin & promo
    v_member_id   uuid;     -- (tanpa %rowtype: tabel member dibuat di bagian 9)
    v_member_biz  text;
    v_has_member  boolean := false;
    v_balance     int := 0;
    v_loyal       boolean;
    v_per         numeric;
    v_pval        numeric;
    v_points_used int := 0;
    v_points_val  numeric := 0;
    v_earned      int := 0;
    v_promo       record;
    v_promos      jsonb := '[]'::jsonb;
    v_promo_disc  numeric := 0;
    v_amt         numeric;
    v_idx         int;
    v_it          jsonb;
    v_covered     int[] := '{}';
    v_free        jsonb;
    v_sets        int;
    v_bid         text;
    v_wib         timestamp := now() at time zone 'Asia/Jakarta';
    v_clock       timestamptz := now();   -- Tahap 6: jam transaksi (offline = jam aslinya)
    v_excess      numeric;
    v_sale_id     uuid;
    -- Tahap 5: resep & HPP
    v_usage       jsonb := '{}'::jsonb;
    v_cogs        numeric := 0;
    v_use         record;
begin
    if v_me is null or not public.erp_has_role(array['kasir']) then
        raise exception 'Akses ditolak: hanya kasir yang boleh mencatat penjualan.';
    end if;

    if not exists (select 1 from public.warehouses where id = v_outlet and kind = 'outlet' and is_active) then
        raise exception 'Outlet tidak ditemukan.';
    end if;

    if v_channel not in ('dine_in', 'take_away', 'delivery', 'gofood', 'grabfood', 'shopeefood') then
        raise exception 'Tipe pesanan tidak valid.';
    end if;

    if jsonb_typeof(p -> 'lines') <> 'array' or jsonb_array_length(p -> 'lines') < 1 then
        raise exception 'Keranjang kasir kosong.';
    end if;

    -- Tahap 3: jualan wajib shift aktif (uang laci tercatat atas nama kasir).
    select id into v_shift from public.pos_shifts
    where cashier_id = v_me and outlet_id = v_outlet and status = 'open' limit 1;
    if v_shift is null then
        raise exception 'Buka shift dulu sebelum berjualan.';
    end if;

    -- Tahap 6: transaksi offline memakai jam aslinya (maks 48 jam lalu, tidak di masa depan).
    if nullif(p ->> 'offline_at', '') is not null then
        v_clock := (p ->> 'offline_at')::timestamptz;
        if v_clock > now() + interval '1 minute' or v_clock < now() - interval '48 hours' then
            raise exception 'Transaksi offline terlalu lama (> 48 jam) atau jamnya tidak wajar. Minta supervisor memeriksa.';
        end if;
        v_wib := v_clock at time zone 'Asia/Jakarta';
    end if;

    if exists (
        select 1 from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) r
        where coalesce(r ->> 'method', 'tunai') not in ('tunai', 'qris', 'debit', 'kredit', 'transfer', 'ewallet')
    ) then
        raise exception 'Metode bayar tidak valid.';
    end if;

    -- Pengaturan outlet (nilai bawaan sama dengan pos-pro.js).
    select settings into v_set from public.pos_settings where outlet_id = v_outlet;
    v_set := coalesce(v_set, '{}'::jsonb);
    v_markup := coalesce((v_set ->> 'online_markup')::numeric, 20);
    v_round := coalesce((v_set ->> 'rounding')::int, 100);

    -- Harga per baris: harga katalog + tambahan varian, lalu harga ojol.
    for v_line in select * from jsonb_array_elements(p -> 'lines') loop
        v_pid := trim(coalesce(v_line ->> 'product_id', ''));
        v_qty := coalesce((v_line ->> 'qty')::int, 0);

        if v_qty < 1 or v_qty > 999 then
            raise exception 'Jumlah barang harus 1–999.';
        end if;

        v_name := null;
        select name, price, coalesce(category, 'Umum') into v_name, v_price, v_category
        from public.products where id::text = v_pid;
        if v_name is null then
            raise exception 'Produk tidak ditemukan (id: %).', v_pid;
        end if;

        v_unit := v_price;
        v_opts := '[]'::jsonb;

        for v_pick in select * from jsonb_array_elements(coalesce(v_line -> 'options', '[]'::jsonb)) loop
            select * into v_group from public.pos_modifier_groups g
            where g.id::text = v_pick ->> 'group_id' and g.is_active
              and (g.applies_all or v_pid = any (g.product_ids) or v_category = any (g.categories));

            if found then
                v_opt := null;
                select o into v_opt from jsonb_array_elements(v_group.options) o
                where o ->> 'id' = v_pick ->> 'option_id' limit 1;

                -- Pilihan yang tidak berlaku untuk produk ini diabaikan.
                if v_opt is not null then
                    v_unit := v_unit + round(coalesce((v_opt ->> 'price')::numeric, 0));
                    v_opts := v_opts || jsonb_build_object(
                        'group_id', v_group.id, 'option_id', v_opt ->> 'id', 'group', v_group.name,
                        'name', v_opt ->> 'name', 'price', round(coalesce((v_opt ->> 'price')::numeric, 0))
                    );
                end if;
            end if;
        end loop;

        if v_channel in ('gofood', 'grabfood', 'shopeefood') and v_markup > 0 then
            v_unit := ceil(round(v_unit * (100 + v_markup)) / 100 / 500) * 500;
        end if;

        v_items := v_items || jsonb_build_object(
            'product_id', v_pid, 'name', v_name, 'qty', v_qty, 'price', v_unit,
            'options', v_opts, 'note', left(trim(coalesce(v_line ->> 'note', '')), 120)
        );
        v_subtotal := v_subtotal + v_unit * v_qty;
    end loop;

    -- Tahap 4: member (pesanan ojol tidak memakai member/poin/promo toko).
    if nullif(p ->> 'member_id', '') is not null and v_channel not in ('gofood', 'grabfood', 'shopeefood') then
        select id, business_id into v_member_id, v_member_biz from public.pos_members where id::text = p ->> 'member_id';
        if v_member_id is null then
            raise exception 'Member tidak ditemukan (mungkin datanya sudah dihapus).';
        end if;
        v_has_member := true;
        select coalesce(sum(delta), 0)::int into v_balance from public.pos_points where member_id = v_member_id;
    end if;

    -- Promo otomatis: semua JAM HEMAT dulu (1 baris maks 1 promo), lalu PAKET HEMAT
    -- dari unit yang belum kena jam hemat. Rumus sama dengan core/promo.js applyPromos.
    if v_channel not in ('gofood', 'grabfood', 'shopeefood') then
        for v_promo in
            select * from public.pos_promos pr
            where pr.is_active
              and (pr.starts_on is null or pr.starts_on <= v_wib::date)
              and (pr.ends_on is null or pr.ends_on >= v_wib::date)
              and (cardinality(pr.days) = 0 or extract(dow from v_wib)::int = any (pr.days))
              and public.erp_pos_in_time(pr.start_time, pr.end_time, (extract(hour from v_wib) * 60 + extract(minute from v_wib))::int)
              and (not pr.members_only or v_has_member)
            order by (pr.kind <> 'happy_hour'), pr.created_at, pr.id
        loop
            v_amt := 0;
            if v_promo.kind = 'happy_hour' and v_promo.percent > 0 then
                for v_idx in 0 .. jsonb_array_length(v_items) - 1 loop
                    continue when v_idx = any (v_covered);
                    v_it := v_items -> v_idx;
                    select coalesce(category, 'Umum') into v_category from public.products where id::text = v_it ->> 'product_id';
                    if (cardinality(v_promo.product_ids) = 0 and cardinality(v_promo.categories) = 0)
                       or (v_it ->> 'product_id') = any (v_promo.product_ids)
                       or coalesce(v_category, 'Umum') = any (v_promo.categories) then
                        v_covered := v_covered || v_idx;
                        v_amt := v_amt + round((v_it ->> 'price')::numeric * (v_it ->> 'qty')::int * least(v_promo.percent, 90) / 100);
                    end if;
                end loop;
            elsif v_promo.kind = 'bundle' and cardinality(v_promo.bundle_ids) >= 2 and v_promo.bundle_amount > 0 then
                if v_free is null then
                    select coalesce(jsonb_object_agg(pid, qty), '{}'::jsonb) into v_free from (
                        select x.value ->> 'product_id' as pid, sum((x.value ->> 'qty')::int) as qty
                        from jsonb_array_elements(v_items) with ordinality as x(value, n)
                        where not ((x.n - 1)::int = any (v_covered))
                        group by 1
                    ) free_units;
                end if;
                select min(coalesce((v_free ->> b)::int, 0)) into v_sets from (select distinct unnest(v_promo.bundle_ids) as b) ids;
                if coalesce(v_sets, 0) >= 1 then
                    for v_bid in select distinct unnest(v_promo.bundle_ids) loop
                        v_free := jsonb_set(v_free, array[v_bid], to_jsonb(coalesce((v_free ->> v_bid)::int, 0) - v_sets), true);
                    end loop;
                    v_amt := v_sets * round(v_promo.bundle_amount);
                end if;
            end if;
            if v_amt > 0 then
                v_promos := v_promos || jsonb_build_array(jsonb_build_object('promo_id', v_promo.id, 'name', v_promo.name, 'kind', v_promo.kind, 'amount', v_amt));
                v_promo_disc := v_promo_disc + v_amt;
            end if;
        end loop;

        -- Pengaman: potongan promo tidak melebihi subtotal (promo terakhir dipangkas).
        v_excess := v_promo_disc - v_subtotal;
        if v_excess > 0 then
            for v_idx in reverse jsonb_array_length(v_promos) - 1 .. 0 loop
                exit when v_excess <= 0;
                v_amt := least((v_promos -> v_idx ->> 'amount')::numeric, v_excess);
                v_promos := jsonb_set(v_promos, array[v_idx::text, 'amount'], to_jsonb((v_promos -> v_idx ->> 'amount')::numeric - v_amt));
                v_excess := v_excess - v_amt;
            end loop;
            v_promo_disc := v_subtotal;
            select coalesce(jsonb_agg(x), '[]'::jsonb) into v_promos from jsonb_array_elements(v_promos) x where (x ->> 'amount')::numeric > 0;
        end if;
    end if;

    -- Diskon manual, lalu tukar poin, lalu service (makan di tempat), PB1, pembulatan.
    v_discount := least(greatest(round(coalesce((p ->> 'discount')::numeric, 0)), 0), v_subtotal - v_promo_disc);

    v_loyal := coalesce((v_set ->> 'loyalty_enabled')::boolean, true);
    v_per := least(greatest(round(coalesce(nullif(v_set ->> 'points_per', '')::numeric, 10000)), 1000), 1000000);
    v_pval := least(greatest(round(coalesce(nullif(v_set ->> 'point_value', '')::numeric, 100)), 1), 10000);
    if v_has_member and v_loyal then
        v_points_used := greatest(0, least(
            floor(coalesce((p ->> 'redeem_points')::numeric, 0))::int,
            v_balance,
            floor((v_subtotal - v_promo_disc - v_discount) / v_pval)::int
        ));
        v_points_val := v_points_used * v_pval;
    end if;

    v_base := v_subtotal - v_promo_disc - v_discount - v_points_val;
    if v_has_member and v_loyal then
        v_earned := greatest(0, floor(v_base / v_per)::int);
    end if;

    -- Tahap 3: diskon di atas batas wajib PIN atasan ("diskon untuk teman").
    if v_discount > 0 and v_subtotal > 0
       and v_discount * 100 / v_subtotal > coalesce((v_set ->> 'discount_pin_percent')::numeric, 20) then
        v_approver := public.erp_pos_approver(p ->> 'approval_pin', v_me);
        if v_approver is null then
            raise exception 'Diskon di atas % persen butuh PIN atasan yang benar.', coalesce((v_set ->> 'discount_pin_percent')::numeric, 20);
        end if;
    end if;

    if v_channel = 'dine_in' and coalesce((v_set ->> 'service_enabled')::boolean, true) then
        v_service := round(v_base * coalesce((v_set ->> 'service_rate')::numeric, 5) / 100);
    end if;

    if v_channel in ('dine_in', 'take_away', 'delivery') and coalesce((v_set ->> 'tax_enabled')::boolean, true) then
        v_tax := round((v_base + v_service) * coalesce((v_set ->> 'tax_rate')::numeric, 10) / 100);
    end if;

    v_raw := v_base + v_service + v_tax;
    v_total := greatest(0, case when v_round > 0 then round(v_raw / v_round) * v_round else v_raw end);

    -- Bayar (boleh campuran). Non-tunai tidak boleh melebihi total; kembalian dari tunai.
    select coalesce(sum(round((r ->> 'amount')::numeric)), 0) into v_noncash
    from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) r
    where coalesce(r ->> 'method', 'tunai') <> 'tunai' and round(coalesce((r ->> 'amount')::numeric, 0)) > 0;

    select coalesce(sum(round((r ->> 'amount')::numeric)), 0) into v_cash
    from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) r
    where coalesce(r ->> 'method', 'tunai') = 'tunai' and round(coalesce((r ->> 'amount')::numeric, 0)) > 0;

    if v_noncash > v_total then
        raise exception 'Pembayaran non-tunai melebihi total. Kurangi nominalnya.';
    end if;

    v_needed := v_total - v_noncash;
    if v_cash < v_needed then
        raise exception 'Pembayaran masih kurang.';
    end if;
    v_change := v_cash - v_needed;

    select coalesce(jsonb_agg(jsonb_build_object('method', m, 'amount', a)), '[]'::jsonb) into v_applied
    from (
        select r ->> 'method' as m, sum(round((r ->> 'amount')::numeric)) as a
        from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) r
        where coalesce(r ->> 'method', 'tunai') <> 'tunai' and round(coalesce((r ->> 'amount')::numeric, 0)) > 0
        group by 1
    ) rows;

    if v_needed > 0 then
        v_applied := v_applied || jsonb_build_array(jsonb_build_object('method', 'tunai', 'amount', v_needed));
    end if;

    v_method := case
        when jsonb_array_length(v_applied) > 1 then 'campuran'
        else coalesce(v_applied -> 0 ->> 'method', 'tunai')
    end;

    -- Tahap 5: pemakaian bahan = resep dasar + resep varian (per porsi tidak pernah minus) × jumlah.
    -- Hanya menu yang punya resep. Rumus sama dengan core/recipe.js orderUsage.
    select coalesce(jsonb_object_agg(ingredient_id, qty), '{}'::jsonb) into v_usage
    from (
        select per.ingredient_id, sum(per.per_unit * per.qty) as qty
        from (
            select it.n, it.qty, r.ingredient_id, greatest(0, sum(r.amount)) as per_unit
            from (
                select x.value as item, x.n, (x.value ->> 'qty')::int as qty
                from jsonb_array_elements(v_items) with ordinality as x(value, n)
                where exists (select 1 from public.pos_recipes rc where rc.product_id = x.value ->> 'product_id' and jsonb_array_length(rc.items) > 0)
            ) it
            cross join lateral (
                select ri ->> 'ingredient_id' as ingredient_id, (ri ->> 'qty')::numeric as amount
                from public.pos_recipes rc, jsonb_array_elements(rc.items) ri
                where rc.product_id = it.item ->> 'product_id'
                union all
                select oi ->> 'ingredient_id', (oi ->> 'qty')::numeric
                from jsonb_array_elements(coalesce(it.item -> 'options', '[]'::jsonb)) o
                join public.pos_option_recipes orc on orc.option_key = (o ->> 'group_id') || ':' || (o ->> 'option_id')
                cross join jsonb_array_elements(orc.items) oi
            ) r
            group by it.n, it.qty, r.ingredient_id
        ) per
        group by per.ingredient_id
        having sum(per.per_unit * per.qty) > 0
    ) used;

    select coalesce(round(sum(u.value::numeric * i.cost)), 0) into v_cogs
    from jsonb_each_text(v_usage) u join public.pos_ingredients i on i.id::text = u.key;

    -- Nomor struk, lalu stok barang jadi (hanya menu TANPA resep; semua atau tidak sama sekali).
    v_receipt := 'POS-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-'
                 || lpad(nextval('public.pos_receipt_seq')::text, 5, '0');

    for v_pid, v_qty in
        select x ->> 'product_id', sum((x ->> 'qty')::int)::int
        from jsonb_array_elements(v_items) x
        where not exists (select 1 from public.pos_recipes rc where rc.product_id = x ->> 'product_id' and jsonb_array_length(rc.items) > 0)
        group by 1
    loop
        insert into public.stock_moves (warehouse_id, product_id, qty, kind, ref, actor_id)
        values (v_outlet, v_pid, -v_qty, 'penjualan', v_receipt, v_me);
    end loop;

    insert into public.pos_sales (
        receipt_no, outlet_id, cashier_id, items, subtotal, discount, total, paid, change, method,
        channel, table_no, customer_name, service, tax, rounding, payments, queue_no,
        shift_id, discount_approved_by,
        member_id, promo_discount, promos, points_used, points_value, points_earned, cogs,
        created_at, offline, synced_at
    ) values (
        v_receipt, v_outlet, v_me, v_items, v_subtotal, v_discount, v_total, v_noncash + v_cash, v_change, v_method,
        v_channel, left(trim(coalesce(p ->> 'table_no', '')), 10), left(trim(coalesce(p ->> 'customer_name', '')), 40),
        v_service, v_tax, v_total - v_raw, v_applied, left(coalesce(p ->> 'queue_no', ''), 10),
        v_shift, v_approver,
        v_member_id, v_promo_disc, v_promos, v_points_used, v_points_val, v_earned, v_cogs,
        v_clock, v_clock <> now(), case when v_clock <> now() then now() end
    ) returning id into v_sale_id;

    -- Bahan dipotong (tidak memblokir: stok minus = tanda perlu hitung ulang) + jurnal HPP.
    for v_use in select key, value::numeric as qty from jsonb_each_text(v_usage) loop
        perform public.erp_pos_ingredient_write(v_outlet, v_use.key::uuid, 'pakai', -v_use.qty, '', v_receipt, null);
    end loop;
    if v_cogs > 0 then
        perform public.erp_journal_write(
            (now() at time zone 'Asia/Jakarta')::date, 'HPP kasir ' || v_receipt, 'pos', v_receipt || '-HPP',
            jsonb_build_array(
                jsonb_build_object('account_code', '5-1000', 'debit', v_cogs),
                jsonb_build_object('account_code', '1-1310', 'credit', v_cogs)
            ), v_me
        );
    end if;

    -- Buku besar poin (business_id: siap jadi poin jaringan lintas brand).
    if v_has_member and v_points_used > 0 then
        insert into public.pos_points (member_id, business_id, sale_id, delta, kind, note)
        values (v_member_id, v_member_biz, v_sale_id, -v_points_used, 'redeem', v_receipt);
    end if;
    if v_has_member and v_earned > 0 then
        insert into public.pos_points (member_id, business_id, sale_id, delta, kind, note)
        values (v_member_id, v_member_biz, v_sale_id, v_earned, 'earn', v_receipt);
    end if;

    -- Jurnal: kas/bank (debit) = penjualan + service + PB1 (kredit).
    if v_total > 0 then
        select coalesce(sum((r ->> 'amount')::numeric), 0) into v_bank
        from jsonb_array_elements(v_applied) r where r ->> 'method' <> 'tunai';

        v_journal := '[]'::jsonb;
        if v_needed > 0 then
            v_journal := v_journal || jsonb_build_array(jsonb_build_object('account_code', '1-1000', 'debit', v_needed));
        end if;
        if v_bank > 0 then
            v_journal := v_journal || jsonb_build_array(jsonb_build_object('account_code', '1-1100', 'debit', v_bank));
        end if;

        v_revenue := v_total - v_service - v_tax;
        if v_revenue > 0 then
            v_journal := v_journal || jsonb_build_array(jsonb_build_object('account_code', '4-1100', 'credit', v_revenue));
        end if;
        if v_service > 0 then
            v_journal := v_journal || jsonb_build_array(jsonb_build_object('account_code', '4-1200', 'credit', v_service));
        end if;
        if v_tax > 0 then
            v_journal := v_journal || jsonb_build_array(jsonb_build_object('account_code', '2-1200', 'credit', v_tax));
        end if;

        perform public.erp_journal_write(
            (now() at time zone 'Asia/Jakarta')::date,
            'Penjualan kasir ' || v_receipt, 'pos', v_receipt, v_journal, v_me
        );
    end if;

    -- Bill terbuka yang sudah dibayar dihapus.
    if nullif(p ->> 'bill_id', '') is not null then
        delete from public.pos_open_bills where id::text = p ->> 'bill_id' and outlet_id = v_outlet;
    end if;

    return jsonb_build_object(
        'id', v_sale_id, 'member_id', v_member_id,
        'promo_discount', v_promo_disc, 'promos', v_promos,
        'points_used', v_points_used, 'points_value', v_points_val, 'points_earned', v_earned, 'cogs', v_cogs,
        'receipt_no', v_receipt, 'items', v_items, 'channel', v_channel,
        'table_no', left(trim(coalesce(p ->> 'table_no', '')), 10),
        'customer_name', left(trim(coalesce(p ->> 'customer_name', '')), 40),
        'queue_no', left(coalesce(p ->> 'queue_no', ''), 10),
        'shift_id', v_shift,
        'subtotal', v_subtotal, 'discount', v_discount, 'service', v_service, 'tax', v_tax,
        'rounding', v_total - v_raw, 'total', v_total, 'payments', v_applied,
        'paid', v_noncash + v_cash, 'change', v_change, 'method', v_method, 'created_at', v_clock
    );
end;
$$;

revoke all on function public.erp_pos_checkout_v2(jsonb) from public;
grant execute on function public.erp_pos_checkout_v2(jsonb) to authenticated;


-- =========================================================
-- 7. TAHAP 2 — DAPUR & ANTRIAN, PENJUALAN YANG HILANG
-- =========================================================

-- Peran baru: Dapur & Bar (barista / koki) — hanya melihat layar dapur.
alter table public.members drop constraint if exists members_job_role_check;
alter table public.members add constraint members_job_role_check
    check (job_role in ('umum', 'sales', 'produk', 'gudang', 'keuangan', 'hr', 'marketing', 'cs', 'kasir', 'dapur'));


-- ---------- Nomor antrian harian per outlet (A-001, A-002, ...) ----------
create table if not exists public.pos_queue_counters (
    outlet_id uuid not null references public.warehouses(id) on delete cascade,
    day       date not null,
    last_no   int not null default 0,
    primary key (outlet_id, day)
);

alter table public.pos_queue_counters enable row level security;
-- Tidak ada policy: hanya lewat erp_pos_next_queue.

create or replace function public.erp_pos_next_queue(p_outlet uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
    v_day date := (now() at time zone 'Asia/Jakarta')::date;
    v_no  int;
begin
    if public.erp_me() is null or not public.erp_has_role(array['kasir']) then
        raise exception 'Akses ditolak: hanya kasir.';
    end if;

    insert into public.pos_queue_counters (outlet_id, day, last_no) values (p_outlet, v_day, 1)
    on conflict (outlet_id, day) do update set last_no = public.pos_queue_counters.last_no + 1
    returning last_no into v_no;

    return 'A-' || lpad(v_no::text, 3, '0');
end;
$$;

revoke all on function public.erp_pos_next_queue(uuid) from public;
grant execute on function public.erp_pos_next_queue(uuid) to authenticated;


-- ---------- Tiket Dapur & Bar ----------
-- items: [{ product_id, name, qty, options: ["Large", ...], note }]
create table if not exists public.pos_tickets (
    id         uuid primary key default gen_random_uuid(),
    outlet_id  uuid not null references public.warehouses(id) on delete cascade,
    queue_no   text not null default '',
    label      text not null default '' check (char_length(label) <= 40),
    channel    text not null default 'dine_in',
    ref        text,
    station    text not null check (station in ('bar', 'dapur')),
    items      jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 100),
    status     text not null default 'baru' check (status in ('baru', 'dibuat', 'siap', 'diambil')),
    created_by uuid references public.members(id) on delete set null default public.erp_me(),
    created_at timestamptz not null default now(),
    started_at timestamptz,
    ready_at   timestamptz,
    picked_at  timestamptz
);

create index if not exists pos_tickets_outlet_idx on public.pos_tickets (outlet_id, created_at desc);

alter table public.pos_tickets enable row level security;

drop policy if exists "erp dapur baca tiket" on public.pos_tickets;
create policy "erp dapur baca tiket" on public.pos_tickets for select
    using (public.erp_has_role(array['kasir', 'dapur', 'keuangan']));
-- Tulis hanya lewat erp_kitchen_send & erp_kitchen_status (waktu dicatat server).

-- p: { outlet_id, queue_no, label, channel, ref, tickets: [{ station, items }] }
create or replace function public.erp_kitchen_send(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_outlet uuid := (p ->> 'outlet_id')::uuid;
    v_part   jsonb;
    v_ids    jsonb := '[]'::jsonb;
    v_id     uuid;
begin
    if public.erp_me() is null or not public.erp_has_role(array['kasir']) then
        raise exception 'Akses ditolak: hanya kasir yang mengirim pesanan ke dapur.';
    end if;

    if not exists (select 1 from public.warehouses where id = v_outlet and kind = 'outlet') then
        raise exception 'Outlet tidak ditemukan.';
    end if;

    for v_part in select * from jsonb_array_elements(coalesce(p -> 'tickets', '[]'::jsonb)) loop
        insert into public.pos_tickets (outlet_id, queue_no, label, channel, ref, station, items)
        values (
            v_outlet,
            left(coalesce(p ->> 'queue_no', ''), 10),
            left(coalesce(p ->> 'label', ''), 40),
            coalesce(nullif(p ->> 'channel', ''), 'dine_in'),
            nullif(p ->> 'ref', ''),
            case when v_part ->> 'station' = 'bar' then 'bar' else 'dapur' end,
            v_part -> 'items'
        )
        returning id into v_id;
        v_ids := v_ids || to_jsonb(v_id);
    end loop;

    return v_ids;
end;
$$;

revoke all on function public.erp_kitchen_send(jsonb) from public;
grant execute on function public.erp_kitchen_send(jsonb) to authenticated;

create or replace function public.erp_kitchen_status(p_ticket uuid, p_status text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_row public.pos_tickets%rowtype;
begin
    if public.erp_me() is null or not public.erp_has_role(array['kasir', 'dapur']) then
        raise exception 'Akses ditolak: hanya dapur, bar & kasir.';
    end if;

    if p_status not in ('baru', 'dibuat', 'siap', 'diambil') then
        raise exception 'Status tidak valid.';
    end if;

    update public.pos_tickets set
        status     = p_status,
        started_at = case when p_status = 'dibuat' then coalesce(started_at, now()) when p_status = 'baru' then null else started_at end,
        ready_at   = case when p_status = 'siap' then now() when p_status = 'baru' then null else ready_at end,
        picked_at  = case when p_status = 'diambil' then now() when p_status = 'baru' then null else picked_at end
    where id = p_ticket
    returning * into v_row;

    if not found then
        raise exception 'Tiket tidak ditemukan.';
    end if;

    return to_jsonb(v_row);
end;
$$;

revoke all on function public.erp_kitchen_status(uuid, text) from public;
grant execute on function public.erp_kitchen_status(uuid, text) to authenticated;


-- ---------- Minat chat AI per produk (ANONIM: hanya hitungan) ----------
-- Dari ai_events (erp-phase4.sql). Bila tabel itu belum ada, hasilnya kosong.
create or replace function public.erp_kitchen_interest(p_hours int default 2)
returns table (product_name text, count bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
    if public.erp_me() is null or not public.erp_has_role(array['kasir', 'dapur']) then
        return;
    end if;

    if to_regclass('public.ai_events') is null then
        return;
    end if;

    return query execute
        'select product_name, count(*) from public.ai_events
         where product_name is not null and at >= now() - make_interval(hours => $1)
         group by product_name'
        using least(greatest(coalesce(p_hours, 2), 1), 24);
end;
$$;

revoke all on function public.erp_kitchen_interest(int) from public;
grant execute on function public.erp_kitchen_interest(int) to authenticated;


-- ---------- Penjualan yang hilang ----------
create table if not exists public.pos_lost_sales (
    id         uuid primary key default gen_random_uuid(),
    outlet_id  uuid not null references public.warehouses(id) on delete cascade,
    product_id text not null default '',
    name       text not null default '' check (char_length(name) <= 80),
    qty        int not null default 1 check (qty between 1 and 999),
    value      numeric(14, 0) not null default 0 check (value >= 0),
    reason     text not null check (reason in ('habis', 'harga', 'lama', 'ganti', 'batal', 'lainnya')),
    created_by uuid references public.members(id) on delete set null default public.erp_me(),
    created_at timestamptz not null default now()
);

create index if not exists pos_lost_sales_outlet_idx on public.pos_lost_sales (outlet_id, created_at desc);

alter table public.pos_lost_sales enable row level security;

drop policy if exists "erp kasir catat penjualan hilang" on public.pos_lost_sales;
create policy "erp kasir catat penjualan hilang" on public.pos_lost_sales for insert
    with check (public.erp_has_role(array['kasir']) and created_by = public.erp_me());

drop policy if exists "erp baca penjualan hilang" on public.pos_lost_sales;
create policy "erp baca penjualan hilang" on public.pos_lost_sales for select
    using (created_by = public.erp_me() or public.erp_has_role(array['keuangan']));


-- =========================================================
-- 8. TAHAP 3 — KONTROL UANG KASIR
-- Pertanyaan terbalik: "bagaimana kasir bisa curang tanpa ketahuan?"
-- =========================================================

create extension if not exists pgcrypto with schema extensions;

-- Keuangan ikut membaca bill terbuka (agar rekonsiliasi tidak salah curiga).
drop policy if exists "erp keuangan baca bill" on public.pos_open_bills;
create policy "erp keuangan baca bill" on public.pos_open_bills for select
    using (public.erp_has_role(array['keuangan']));


-- ---------- PIN persetujuan atasan (bcrypt, tidak pernah disimpan polos) ----------
create table if not exists public.pos_pins (
    member_id  uuid primary key references public.members(id) on delete cascade,
    pin_hash   text not null,
    updated_at timestamptz not null default now()
);

alter table public.pos_pins enable row level security;
-- Tidak ada policy: hash PIN tidak pernah bisa dibaca dari browser.

create or replace function public.erp_pos_set_pin(p_pin text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
    v_me uuid := public.erp_me();
begin
    if v_me is null or public.erp_my_level() < 3 then
        raise exception 'Akses ditolak: PIN persetujuan khusus supervisor ke atas.';
    end if;
    if p_pin !~ '^[0-9]{4,6}$' then
        raise exception 'PIN harus 4–6 angka.';
    end if;
    if p_pin ~ '^([0-9])\1+$' or position(p_pin in '0123456789') > 0 then
        raise exception 'PIN terlalu mudah ditebak.';
    end if;

    insert into public.pos_pins (member_id, pin_hash, updated_at)
    values (v_me, extensions.crypt(p_pin, extensions.gen_salt('bf')), now())
    on conflict (member_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
end;
$$;

revoke all on function public.erp_pos_set_pin(text) from public;
grant execute on function public.erp_pos_set_pin(text) to authenticated;

create or replace function public.erp_pos_has_pin()
returns boolean
language sql stable security definer set search_path = public
as $$
    select exists (select 1 from public.pos_pins where member_id = public.erp_me());
$$;

revoke all on function public.erp_pos_has_pin() from public;
grant execute on function public.erp_pos_has_pin() to authenticated;

-- Internal: siapa atasan pemilik PIN ini? (level 3+, aktif; tidak boleh menyetujui
-- dirinya sendiri kecuali owner/manajer). TIDAK dibuka ke browser.
create or replace function public.erp_pos_approver(p_pin text, p_actor uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
    select m.id
    from public.pos_pins pp
    join public.members m on m.id = pp.member_id
    where m.is_active and m.level >= 3
      and coalesce(p_pin, '') ~ '^[0-9]{4,6}$'
      and pp.pin_hash = extensions.crypt(p_pin, pp.pin_hash)
      and (m.id <> p_actor or coalesce((select level from public.members where id = p_actor), 0) >= 4)
    limit 1;
$$;

revoke all on function public.erp_pos_approver(text, uuid) from public;


-- ---------- Shift kasir & kas masuk/keluar ----------
create table if not exists public.pos_shifts (
    id            uuid primary key default gen_random_uuid(),
    outlet_id     uuid not null references public.warehouses(id) on delete cascade,
    cashier_id    uuid not null references public.members(id) on delete cascade,
    status        text not null default 'open' check (status in ('open', 'closed')),
    opening_cash  numeric(14, 0) not null check (opening_cash >= 0),
    opened_at     timestamptz not null default now(),
    closed_at     timestamptz,
    counted_cash  numeric(14, 0),
    expected_cash numeric(14, 0),
    variance      numeric(14, 0),
    note          text not null default '' check (char_length(note) <= 200)
);

create unique index if not exists pos_shifts_one_open on public.pos_shifts (cashier_id) where status = 'open';
create index if not exists pos_shifts_outlet_idx on public.pos_shifts (outlet_id, opened_at desc);

create table if not exists public.pos_cash_moves (
    id         uuid primary key default gen_random_uuid(),
    shift_id   uuid not null references public.pos_shifts(id) on delete cascade,
    kind       text not null check (kind in ('masuk', 'keluar')),
    amount     numeric(14, 0) not null check (amount > 0),
    reason     text not null check (char_length(reason) between 1 and 80),
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now()
);

alter table public.pos_shifts enable row level security;
alter table public.pos_cash_moves enable row level security;

drop policy if exists "erp baca shift" on public.pos_shifts;
create policy "erp baca shift" on public.pos_shifts for select
    using (cashier_id = public.erp_me() or public.erp_has_role(array['keuangan']));

drop policy if exists "erp baca kas shift" on public.pos_cash_moves;
create policy "erp baca kas shift" on public.pos_cash_moves for select
    using (exists (
        select 1 from public.pos_shifts s where s.id = shift_id
        and (s.cashier_id = public.erp_me() or public.erp_has_role(array['keuangan']))
    ));
-- Tulis hanya lewat fungsi di bawah.

alter table public.pos_sales add column if not exists shift_id             uuid references public.pos_shifts(id) on delete set null;
alter table public.pos_sales add column if not exists discount_approved_by uuid references public.members(id) on delete set null;
alter table public.pos_sales add column if not exists voided_at            timestamptz;
alter table public.pos_sales add column if not exists void_reason          text;
alter table public.pos_sales add column if not exists void_note            text not null default '';
alter table public.pos_sales add column if not exists void_by              uuid references public.members(id) on delete set null;
alter table public.pos_sales add column if not exists void_approved_by     uuid references public.members(id) on delete set null;
alter table public.pos_sales add column if not exists refund_cash          numeric(14, 0) not null default 0;
alter table public.pos_sales add column if not exists refund_shift_id      uuid references public.pos_shifts(id) on delete set null;

-- Uang tunai yang benar-benar masuk dari satu penjualan (sama dengan cashOf di cash-control.js).
create or replace function public.erp_pos_cash_of(p_payments jsonb, p_method text, p_total numeric)
returns numeric
language sql immutable
as $$
    select case
        when jsonb_typeof(p_payments) = 'array' and jsonb_array_length(p_payments) > 0 then
            coalesce((select sum((x ->> 'amount')::numeric) from jsonb_array_elements(p_payments) x where x ->> 'method' = 'tunai'), 0)
        when p_method = 'tunai' then p_total
        else 0
    end;
$$;

-- Ringkasan shift (sama dengan shiftSummary di cash-control.js).
create or replace function public.erp_pos_shift_summary(p_shift uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
    v_shift   public.pos_shifts%rowtype;
    v_cash    numeric;
    v_gross   numeric;
    v_noncash numeric;
    v_count   int;
    v_voids   int;
    v_refund  numeric;
    v_in      numeric;
    v_out     numeric;
    v_exp     numeric;
begin
    select * into v_shift from public.pos_shifts where id = p_shift;

    select coalesce(sum(public.erp_pos_cash_of(payments, method, total)), 0),
           coalesce(sum(total) filter (where status <> 'batal'), 0),
           coalesce(sum(total - public.erp_pos_cash_of(payments, method, total)) filter (where status <> 'batal'), 0),
           count(*) filter (where status <> 'batal'),
           count(*) filter (where status = 'batal')
      into v_cash, v_gross, v_noncash, v_count, v_voids
      from public.pos_sales where shift_id = p_shift;

    select coalesce(sum(refund_cash), 0) into v_refund from public.pos_sales where refund_shift_id = p_shift;
    select coalesce(sum(amount) filter (where kind = 'masuk'), 0), coalesce(sum(amount) filter (where kind = 'keluar'), 0)
      into v_in, v_out from public.pos_cash_moves where shift_id = p_shift;

    v_exp := v_shift.opening_cash + v_cash - v_refund + v_in - v_out;

    return jsonb_build_object(
        'transactions', v_count, 'voids', v_voids, 'gross', v_gross, 'cashSales', v_cash, 'nonCash', v_noncash,
        'refundCash', v_refund, 'cashIn', v_in, 'cashOut', v_out, 'expected', v_exp,
        'variance', case when v_shift.counted_cash is null then null else v_shift.counted_cash - v_exp end
    );
end;
$$;

revoke all on function public.erp_pos_shift_summary(uuid) from public;

create or replace function public.erp_pos_my_shift(p_outlet uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
    select to_jsonb(s) from public.pos_shifts s
    where s.cashier_id = public.erp_me() and s.outlet_id = p_outlet and s.status = 'open'
    limit 1;
$$;

revoke all on function public.erp_pos_my_shift(uuid) from public;
grant execute on function public.erp_pos_my_shift(uuid) to authenticated;

create or replace function public.erp_pos_open_shift(p_outlet uuid, p_opening numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_me  uuid := public.erp_me();
    v_row public.pos_shifts%rowtype;
begin
    if v_me is null or not public.erp_has_role(array['kasir']) then
        raise exception 'Akses ditolak: hanya kasir yang membuka shift.';
    end if;
    if not exists (select 1 from public.warehouses where id = p_outlet and kind = 'outlet' and is_active) then
        raise exception 'Outlet tidak ditemukan.';
    end if;
    if exists (select 1 from public.pos_shifts where cashier_id = v_me and status = 'open') then
        raise exception 'Kamu masih punya shift yang belum ditutup.';
    end if;
    if p_opening is null or p_opening < 0 or p_opening > 100000000 then
        raise exception 'Isi modal awal laci dengan benar.';
    end if;

    insert into public.pos_shifts (outlet_id, cashier_id, opening_cash)
    values (p_outlet, v_me, round(p_opening))
    returning * into v_row;

    return to_jsonb(v_row);
end;
$$;

revoke all on function public.erp_pos_open_shift(uuid, numeric) from public;
grant execute on function public.erp_pos_open_shift(uuid, numeric) to authenticated;

create or replace function public.erp_pos_cash_move(p_shift uuid, p_kind text, p_amount numeric, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_me  uuid := public.erp_me();
    v_row public.pos_cash_moves%rowtype;
begin
    if not exists (select 1 from public.pos_shifts where id = p_shift and cashier_id = v_me and status = 'open') then
        raise exception 'Shift tidak aktif.';
    end if;
    if p_kind not in ('masuk', 'keluar') then
        raise exception 'Jenis kas tidak valid.';
    end if;
    if coalesce(p_amount, 0) <= 0 then
        raise exception 'Isi nominal kas.';
    end if;
    if char_length(trim(coalesce(p_reason, ''))) = 0 then
        raise exception 'Tulis alasannya (mis. beli es batu).';
    end if;

    insert into public.pos_cash_moves (shift_id, kind, amount, reason, created_by)
    values (p_shift, p_kind, round(p_amount), left(trim(p_reason), 80), v_me)
    returning * into v_row;

    return to_jsonb(v_row);
end;
$$;

revoke all on function public.erp_pos_cash_move(uuid, text, numeric, text) from public;
grant execute on function public.erp_pos_cash_move(uuid, text, numeric, text) to authenticated;

-- Tutup BUTA: kasir hanya mengirim hitungan laci; "seharusnya" dihitung di sini.
create or replace function public.erp_pos_close_shift(p_shift uuid, p_counted numeric, p_note text default '')
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_me      uuid := public.erp_me();
    v_summary jsonb;
    v_row     public.pos_shifts%rowtype;
begin
    if not exists (select 1 from public.pos_shifts where id = p_shift and cashier_id = v_me and status = 'open') then
        raise exception 'Shift tidak aktif.';
    end if;
    if p_counted is null or p_counted < 0 then
        raise exception 'Isi jumlah uang di laci.';
    end if;

    v_summary := public.erp_pos_shift_summary(p_shift);

    update public.pos_shifts set
        status = 'closed', closed_at = now(), counted_cash = round(p_counted),
        expected_cash = (v_summary ->> 'expected')::numeric,
        variance = round(p_counted) - (v_summary ->> 'expected')::numeric,
        note = left(coalesce(p_note, ''), 200)
    where id = p_shift
    returning * into v_row;

    return jsonb_build_object('shift', to_jsonb(v_row), 'summary', v_summary || jsonb_build_object('variance', v_row.variance));
end;
$$;

revoke all on function public.erp_pos_close_shift(uuid, numeric, text) from public;
grant execute on function public.erp_pos_close_shift(uuid, numeric, text) to authenticated;


-- ---------- Void (batal transaksi) wajib PIN atasan ----------
create or replace function public.erp_pos_void(p_sale uuid, p_reason text, p_note text, p_pin text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_me       uuid := public.erp_me();
    v_sale     public.pos_sales%rowtype;
    v_approver uuid;
    v_cash     numeric;
    v_bank     numeric;
    v_shift    uuid;
    v_pid      text;
    v_qty      int;
    v_journal  jsonb := '[]'::jsonb;
    v_revenue  numeric;
    v_use      record;
    v_cogs     numeric;
begin
    if v_me is null or not public.erp_has_role(array['kasir']) then
        raise exception 'Akses ditolak: hanya kasir.';
    end if;
    if p_reason not in ('salah_input', 'pelanggan_batal', 'produk_bermasalah', 'pembayaran_gagal', 'lainnya') then
        raise exception 'Pilih alasan pembatalan.';
    end if;

    select * into v_sale from public.pos_sales where id = p_sale for update;
    if not found or v_sale.status = 'batal' then
        raise exception 'Transaksi tidak ditemukan atau sudah dibatalkan.';
    end if;

    v_approver := public.erp_pos_approver(p_pin, v_me);
    if v_approver is null then
        raise exception 'PIN atasan salah (atau atasan tidak boleh menyetujui dirinya sendiri).';
    end if;

    v_cash := public.erp_pos_cash_of(v_sale.payments, v_sale.method, v_sale.total);
    v_bank := v_sale.total - v_cash;
    if v_cash > 0 then
        select id into v_shift from public.pos_shifts where cashier_id = v_me and status = 'open' limit 1;
        if v_shift is null then
            raise exception 'Buka shift dulu: uang tunai dikembalikan dari laci shift aktif.';
        end if;
    end if;

    -- Tahap 5: bahan kembali sesuai yang dipotong saat jual + HPP dibalik.
    for v_use in
        select ingredient_id, -sum(delta) as qty from public.pos_ingredient_moves
        where ref = v_sale.receipt_no and kind = 'pakai' group by 1
    loop
        perform public.erp_pos_ingredient_write(v_sale.outlet_id, v_use.ingredient_id, 'void', v_use.qty, '', v_sale.receipt_no || '-VOID', null);
    end loop;
    v_cogs := coalesce((to_jsonb(v_sale) ->> 'cogs')::numeric, 0);
    if v_cogs > 0 then
        perform public.erp_journal_write(
            (now() at time zone 'Asia/Jakarta')::date, 'Void HPP ' || v_sale.receipt_no, 'pos', v_sale.receipt_no || '-HPP-VOID',
            jsonb_build_array(
                jsonb_build_object('account_code', '1-1310', 'debit', v_cogs),
                jsonb_build_object('account_code', '5-1000', 'credit', v_cogs)
            ), v_me
        );
    end if;

    -- Stok barang jadi kembali ke outlet (hanya menu tanpa resep).
    for v_pid, v_qty in
        select x ->> 'product_id', sum((x ->> 'qty')::int)::int from jsonb_array_elements(v_sale.items) x
        where not exists (select 1 from public.pos_recipes rc where rc.product_id = x ->> 'product_id' and jsonb_array_length(rc.items) > 0)
        group by 1
    loop
        insert into public.stock_moves (warehouse_id, product_id, qty, kind, ref, note, actor_id)
        values (v_sale.outlet_id, v_pid, v_qty, 'retur', v_sale.receipt_no || '-VOID', 'Void transaksi kasir', v_me);
    end loop;

    -- Jurnal balik.
    if v_sale.total > 0 then
        v_revenue := v_sale.total - coalesce(v_sale.service, 0) - coalesce(v_sale.tax, 0);
        if v_revenue > 0 then
            v_journal := v_journal || jsonb_build_array(jsonb_build_object('account_code', '4-1100', 'debit', v_revenue));
        end if;
        if coalesce(v_sale.service, 0) > 0 then
            v_journal := v_journal || jsonb_build_array(jsonb_build_object('account_code', '4-1200', 'debit', v_sale.service));
        end if;
        if coalesce(v_sale.tax, 0) > 0 then
            v_journal := v_journal || jsonb_build_array(jsonb_build_object('account_code', '2-1200', 'debit', v_sale.tax));
        end if;
        if v_cash > 0 then
            v_journal := v_journal || jsonb_build_array(jsonb_build_object('account_code', '1-1000', 'credit', v_cash));
        end if;
        if v_bank > 0 then
            v_journal := v_journal || jsonb_build_array(jsonb_build_object('account_code', '1-1100', 'credit', v_bank));
        end if;

        perform public.erp_journal_write(
            (now() at time zone 'Asia/Jakarta')::date,
            'Void kasir ' || v_sale.receipt_no, 'pos', v_sale.receipt_no || '-VOID', v_journal, v_me
        );
    end if;

    -- Tahap 4: poin dari transaksi ini dibalik (yang didapat ditarik, yang dipakai dikembalikan).
    insert into public.pos_points (member_id, business_id, sale_id, delta, kind, note)
    select member_id, business_id, sale_id, -delta, 'reversal', v_sale.receipt_no || '-VOID'
    from public.pos_points where sale_id = p_sale and kind <> 'reversal';

    update public.pos_sales set
        status = 'batal', voided_at = now(), void_reason = p_reason, void_note = left(coalesce(p_note, ''), 200),
        void_by = v_me, void_approved_by = v_approver, refund_cash = v_cash, refund_shift_id = v_shift
    where id = p_sale
    returning * into v_sale;

    return to_jsonb(v_sale);
end;
$$;

revoke all on function public.erp_pos_void(uuid, text, text, text) from public;
grant execute on function public.erp_pos_void(uuid, text, text, text) to authenticated;

-- =========================================================
-- 9. TAHAP 4: MEMBER, POIN & PROMO
--    Pertanyaan terbalik: "kenapa pelanggan menolak jadi member & kenapa promo membakar uang?"
--    Member cukup nama + HP, 2 izin terpisah, bisa minta DIHAPUS (UU PDP 27/2022).
--    Nomor HP tidak pernah dibaca langsung dari browser: hanya lewat fungsi (tersamar),
--    nomor lengkap hanya untuk member yang mengizinkan promo.
-- =========================================================

create table if not exists public.pos_members (
    id              uuid primary key default gen_random_uuid(),
    business_id     text not null default 'kantoong',
    name            text not null check (char_length(name) between 1 and 60),
    phone           text not null unique check (phone ~ '^628[0-9]{7,12}$'),
    consent_history boolean not null default true check (consent_history),
    consent_promo   boolean not null default false,
    consent_at      timestamptz not null default now(),
    joined_at       timestamptz not null default now(),
    created_by      uuid references public.members(id) on delete set null
);

alter table public.pos_members enable row level security;
-- Tidak ada policy: baca & tulis hanya lewat fungsi di bawah.

create table if not exists public.pos_points (
    id          bigserial primary key,
    member_id   uuid not null references public.pos_members(id) on delete cascade,
    business_id text not null default 'kantoong',
    sale_id     uuid references public.pos_sales(id) on delete set null,
    delta       int not null,
    kind        text not null check (kind in ('earn', 'redeem', 'reversal', 'adjust')),
    note        text not null default '',
    created_at  timestamptz not null default now()
);
create index if not exists pos_points_member_idx on public.pos_points (member_id);

alter table public.pos_points enable row level security;
drop policy if exists "erp baca poin" on public.pos_points;
create policy "erp baca poin" on public.pos_points for select
    using (public.erp_my_level() >= 3 or public.erp_has_role(array['marketing', 'keuangan']));

create table if not exists public.pos_promos (
    id            uuid primary key default gen_random_uuid(),
    name          text not null check (char_length(name) between 1 and 60),
    kind          text not null check (kind in ('happy_hour', 'bundle')),
    percent       numeric(5, 0) not null default 0 check (percent between 0 and 90),
    product_ids   text[] not null default '{}',
    categories    text[] not null default '{}',
    days          int[] not null default '{}',
    start_time    text not null default '' check (start_time = '' or start_time ~ '^[0-9]{1,2}:[0-9]{2}$'),
    end_time      text not null default '' check (end_time = '' or end_time ~ '^[0-9]{1,2}:[0-9]{2}$'),
    bundle_ids    text[] not null default '{}',
    bundle_amount numeric(14, 0) not null default 0 check (bundle_amount >= 0),
    members_only  boolean not null default false,
    starts_on     date,
    ends_on       date,
    is_active     boolean not null default true,
    created_by    uuid references public.members(id) on delete set null default public.erp_me(),
    created_at    timestamptz not null default now()
);

alter table public.pos_promos enable row level security;
drop policy if exists "erp baca promo" on public.pos_promos;
create policy "erp baca promo" on public.pos_promos for select
    using (public.erp_me() is not null);
drop policy if exists "erp kelola promo" on public.pos_promos;
create policy "erp kelola promo" on public.pos_promos for all
    using (public.erp_my_level() >= 4 or public.erp_has_role(array['marketing']))
    with check (public.erp_my_level() >= 4 or public.erp_has_role(array['marketing']));

alter table public.pos_sales add column if not exists member_id      uuid references public.pos_members(id) on delete set null;
alter table public.pos_sales add column if not exists promo_discount numeric(14, 0) not null default 0;
alter table public.pos_sales add column if not exists promos         jsonb not null default '[]'::jsonb;
alter table public.pos_sales add column if not exists points_used    int not null default 0;
alter table public.pos_sales add column if not exists points_value   numeric(14, 0) not null default 0;
alter table public.pos_sales add column if not exists points_earned  int not null default 0;
alter table public.pos_open_bills add column if not exists member_id uuid references public.pos_members(id) on delete set null;

-- Jam promo "HH:MM"–"HH:MM" (boleh lewat tengah malam). Kosong = sepanjang hari.
create or replace function public.erp_pos_in_time(p_start text, p_end text, p_min int)
returns boolean
language plpgsql immutable
as $$
declare
    v_s int;
    v_e int;
begin
    if coalesce(p_start, '') !~ '^[0-9]{1,2}:[0-9]{2}$' or coalesce(p_end, '') !~ '^[0-9]{1,2}:[0-9]{2}$' then
        return true;
    end if;
    v_s := least(split_part(p_start, ':', 1)::int * 60 + split_part(p_start, ':', 2)::int, 1440);
    v_e := least(split_part(p_end, ':', 1)::int * 60 + split_part(p_end, ':', 2)::int, 1440);
    if v_s = v_e then return true; end if;
    if v_s < v_e then return p_min >= v_s and p_min < v_e; end if;
    return p_min >= v_s or p_min < v_e;
end;
$$;

-- "0812-3456-789" / "+62 812..." / "812..." -> "62812..." (sama dengan normalizePhone).
create or replace function public.erp_pos_norm_phone(p_raw text)
returns text
language plpgsql immutable
as $$
declare
    v text := regexp_replace(coalesce(p_raw, ''), '\D', '', 'g');
begin
    if v like '0%' then v := '62' || substr(v, 2);
    elsif v like '8%' then v := '62' || v;
    end if;
    return case when v ~ '^628[0-9]{7,12}$' then v else '' end;
end;
$$;

-- Data member yang aman ditampilkan. Nomor lengkap hanya bila diminta DAN member mengizinkan promo.
create or replace function public.erp_pos_member_json(p_member public.pos_members, p_contact boolean)
returns jsonb
language sql stable security definer set search_path = public
as $$
    select jsonb_build_object(
        'id', p_member.id,
        'name', p_member.name,
        'phone_masked', '0' || substr(p_member.phone, 3, 3) || '-****-' || right(p_member.phone, 3),
        'phone', case when p_contact and p_member.consent_promo
            then regexp_replace('0' || substr(p_member.phone, 3), '^([0-9]{4})([0-9]{4})([0-9]+)$', '\1-\2-\3') end,
        'consent_history', p_member.consent_history,
        'consent_promo', p_member.consent_promo,
        'joined_at', p_member.joined_at,
        'points', coalesce((select sum(delta) from public.pos_points where member_id = p_member.id), 0)
    );
$$;
revoke all on function public.erp_pos_member_json(public.pos_members, boolean) from public;

create or replace function public.erp_pos_member_find(p_query text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
    v_text   text := lower(trim(coalesce(p_query, '')));
    v_phone  text := public.erp_pos_norm_phone(p_query);
    v_digits text := regexp_replace(regexp_replace(coalesce(p_query, ''), '\D', '', 'g'), '^0', '');
begin
    if not public.erp_has_role(array['kasir', 'marketing', 'cs']) then return '[]'::jsonb; end if;
    if char_length(v_text) < 3 then return '[]'::jsonb; end if;
    return coalesce((
        select jsonb_agg(public.erp_pos_member_json(m, false))
        from (
            select * from public.pos_members m
            where (v_phone <> '' and m.phone = v_phone)
               or (char_length(v_digits) >= 4 and m.phone like '%' || v_digits || '%')
               or lower(m.name) like '%' || v_text || '%'
            order by m.name
            limit 8
        ) m
    ), '[]'::jsonb);
end;
$$;
revoke all on function public.erp_pos_member_find(text) from public;
grant execute on function public.erp_pos_member_find(text) to authenticated;

-- Kartu member di kasir: data aman + riwayat belanja (hanya bila member mengizinkan) -> Kasir yang Ingat.
create or replace function public.erp_pos_member_card(p_member uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
    v_member public.pos_members%rowtype;
begin
    if not public.erp_has_role(array['kasir', 'marketing', 'cs']) then
        raise exception 'Akses ditolak: jabatanmu tidak boleh melakukan ini.';
    end if;
    select * into v_member from public.pos_members where id = p_member;
    if not found then raise exception 'Member tidak ditemukan.'; end if;
    return jsonb_build_object(
        'member', public.erp_pos_member_json(v_member, false),
        'sales', case when v_member.consent_history then coalesce((
            select jsonb_agg(jsonb_build_object('items', s.items, 'total', s.total, 'channel', s.channel, 'created_at', s.created_at, 'status', s.status) order by s.created_at)
            from (select * from public.pos_sales where member_id = p_member and status <> 'batal' order by created_at desc limit 60) s
        ), '[]'::jsonb) else '[]'::jsonb end
    );
end;
$$;
revoke all on function public.erp_pos_member_card(uuid) from public;
grant execute on function public.erp_pos_member_card(uuid) to authenticated;

create or replace function public.erp_pos_member_save(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_me    uuid := public.erp_me();
    v_name  text := left(trim(coalesce(p ->> 'name', '')), 60);
    v_phone text := public.erp_pos_norm_phone(p ->> 'phone');
    v_promo boolean := coalesce((p ->> 'consent_promo')::boolean, false);
    v_twin  text;
    v_row   public.pos_members%rowtype;
begin
    if v_me is null or not public.erp_has_role(array['kasir', 'marketing', 'cs']) then
        raise exception 'Akses ditolak: jabatanmu tidak boleh melakukan ini.';
    end if;
    if v_name = '' then raise exception 'Isi nama member.'; end if;
    if v_phone = '' then raise exception 'Nomor HP tidak valid (contoh: 0812xxxxxxx).'; end if;
    if not coalesce((p ->> 'consent_history')::boolean, false) then
        raise exception 'Member wajib setuju riwayat belanja & poin disimpan. Tanpa izin itu, layani sebagai tamu biasa.';
    end if;
    select name into v_twin from public.pos_members
    where phone = v_phone and id::text is distinct from nullif(p ->> 'id', '');
    if v_twin is not null then
        raise exception 'Nomor ini sudah terdaftar atas nama %.', v_twin;
    end if;

    if nullif(p ->> 'id', '') is not null then
        update public.pos_members set
            name = v_name, phone = v_phone, consent_history = true,
            consent_at = case when consent_promo is distinct from v_promo then now() else consent_at end,
            consent_promo = v_promo
        where id::text = p ->> 'id'
        returning * into v_row;
        if not found then raise exception 'Member tidak ditemukan.'; end if;
    else
        insert into public.pos_members (name, phone, consent_history, consent_promo, created_by)
        values (v_name, v_phone, true, v_promo, v_me)
        returning * into v_row;
    end if;
    return public.erp_pos_member_json(v_row, false);
end;
$$;
revoke all on function public.erp_pos_member_save(jsonb) from public;
grant execute on function public.erp_pos_member_save(jsonb) to authenticated;

-- Hak dihapus (UU PDP): data member & poin dihapus; struk lama tetap ada tanpa identitas.
create or replace function public.erp_pos_member_forget(p_member uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
    v_name text;
begin
    if not public.erp_has_role(array['kasir', 'cs']) then
        raise exception 'Akses ditolak: jabatanmu tidak boleh melakukan ini.';
    end if;
    select name into v_name from public.pos_members where id = p_member;
    if v_name is null then return; end if;
    update public.pos_sales set customer_name = '' where member_id = p_member and customer_name = v_name;
    update public.pos_sales set member_id = null where member_id = p_member;
    update public.pos_open_bills set member_id = null where member_id = p_member;
    delete from public.pos_members where id = p_member; -- poin ikut terhapus (cascade)
end;
$$;
revoke all on function public.erp_pos_member_forget(uuid) from public;
grant execute on function public.erp_pos_member_forget(uuid) to authenticated;

-- Daftar member untuk owner/marketing (nomor lengkap hanya yang mengizinkan promo).
create or replace function public.erp_pos_members()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
    if not (public.erp_my_level() >= 3 or public.erp_has_role(array['marketing', 'keuangan', 'cs'])) then
        return '[]'::jsonb;
    end if;
    return coalesce((select jsonb_agg(public.erp_pos_member_json(m, true) order by m.joined_at) from public.pos_members m), '[]'::jsonb);
end;
$$;
revoke all on function public.erp_pos_members() from public;
grant execute on function public.erp_pos_members() to authenticated;

-- Riwayat belanja member yang mengizinkan riwayat disimpan (Radar pelanggan menghilang).
create or replace function public.erp_pos_member_sales()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
    if not (public.erp_my_level() >= 3 or public.erp_has_role(array['marketing', 'keuangan'])) then
        return '[]'::jsonb;
    end if;
    return coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', s.id, 'member_id', s.member_id, 'items', s.items, 'total', s.total,
            'channel', s.channel, 'created_at', s.created_at, 'status', s.status
        ) order by s.created_at)
        from public.pos_sales s join public.pos_members m on m.id = s.member_id
        where m.consent_history and s.created_at >= now() - interval '180 days'
    ), '[]'::jsonb);
end;
$$;
revoke all on function public.erp_pos_member_sales() from public;
grant execute on function public.erp_pos_member_sales() to authenticated;

-- =========================================================
-- 10. TAHAP 5: BAHAN BAKU, RESEP & HPP
--     Pertanyaan terbalik: "kenapa kafe ramai tapi tetap rugi, dan bagaimana bahan hilang?"
--     Harga modal bahan hanya dibaca supervisor ke atas / produk / gudang / keuangan
--     (lewat fungsi). Hitung stok BUTA: kasir/gudang hanya mengisi hasil hitung.
-- =========================================================

insert into public.accounts (code, name, type) values
    ('1-1310', 'Persediaan bahan baku', 'aset'),
    ('5-1100', 'Bahan hilang & terbuang', 'beban')
on conflict (code) do nothing;

create table if not exists public.pos_ingredients (
    id         uuid primary key default gen_random_uuid(),
    name       text not null unique check (char_length(name) between 1 and 60),
    unit       text not null default 'gram' check (unit in ('gram', 'ml', 'pcs')),
    cost       numeric(14, 2) not null default 0 check (cost >= 0),
    min_stock  numeric(14, 2) not null default 0 check (min_stock >= 0),
    is_active  boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.pos_ingredients enable row level security;
drop policy if exists "erp kelola bahan" on public.pos_ingredients;
create policy "erp kelola bahan" on public.pos_ingredients for all
    using (public.erp_my_level() >= 4 or public.erp_has_role(array['produk', 'gudang']))
    with check (public.erp_my_level() >= 4 or public.erp_has_role(array['produk', 'gudang']));

create table if not exists public.pos_ingredient_stock (
    outlet_id     uuid not null references public.warehouses(id) on delete cascade,
    ingredient_id uuid not null references public.pos_ingredients(id) on delete cascade,
    qty           numeric(14, 2) not null default 0,
    primary key (outlet_id, ingredient_id)
);
alter table public.pos_ingredient_stock enable row level security;
-- Tidak ada policy: baca lewat erp_pos_ingredients(), tulis lewat fungsi.

create table if not exists public.pos_recipes (
    product_id text primary key,
    items      jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);
create table if not exists public.pos_option_recipes (
    option_key text primary key,   -- "<group_id>:<option_id>"
    items      jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);
alter table public.pos_recipes enable row level security;
alter table public.pos_option_recipes enable row level security;
drop policy if exists "erp baca resep" on public.pos_recipes;
create policy "erp baca resep" on public.pos_recipes for select using (public.erp_me() is not null);
drop policy if exists "erp kelola resep" on public.pos_recipes;
create policy "erp kelola resep" on public.pos_recipes for all
    using (public.erp_my_level() >= 4 or public.erp_has_role(array['produk']))
    with check (public.erp_my_level() >= 4 or public.erp_has_role(array['produk']));
drop policy if exists "erp baca resep varian" on public.pos_option_recipes;
create policy "erp baca resep varian" on public.pos_option_recipes for select using (public.erp_me() is not null);
drop policy if exists "erp kelola resep varian" on public.pos_option_recipes;
create policy "erp kelola resep varian" on public.pos_option_recipes for all
    using (public.erp_my_level() >= 4 or public.erp_has_role(array['produk']))
    with check (public.erp_my_level() >= 4 or public.erp_has_role(array['produk']));

create table if not exists public.pos_ingredient_moves (
    id            bigserial primary key,
    outlet_id     uuid not null references public.warehouses(id) on delete cascade,
    ingredient_id uuid not null references public.pos_ingredients(id) on delete cascade,
    kind          text not null check (kind in ('pakai', 'void', 'beli', 'buang', 'opname')),
    delta         numeric(14, 2) not null,
    unit_cost     numeric(14, 2) not null default 0,
    reason        text not null default '',
    ref           text not null default '',
    created_by    uuid references public.members(id) on delete set null,
    created_at    timestamptz not null default now()
);
create index if not exists pos_ingredient_moves_idx on public.pos_ingredient_moves (outlet_id, created_at desc);
create index if not exists pos_ingredient_moves_ref_idx on public.pos_ingredient_moves (ref);
alter table public.pos_ingredient_moves enable row level security;
drop policy if exists "erp baca gerak bahan" on public.pos_ingredient_moves;
create policy "erp baca gerak bahan" on public.pos_ingredient_moves for select
    using (public.erp_my_level() >= 3 or public.erp_has_role(array['produk', 'gudang', 'keuangan', 'dapur']));

alter table public.pos_sales add column if not exists cogs numeric(14, 0) not null default 0;

-- Internal: ubah stok bahan + catat geraknya.
create or replace function public.erp_pos_ingredient_write(
    p_outlet uuid, p_ingredient uuid, p_kind text, p_delta numeric, p_reason text, p_ref text, p_unit_cost numeric
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
    insert into public.pos_ingredient_stock (outlet_id, ingredient_id, qty)
    values (p_outlet, p_ingredient, round(p_delta, 2))
    on conflict (outlet_id, ingredient_id) do update set qty = public.pos_ingredient_stock.qty + round(p_delta, 2);

    insert into public.pos_ingredient_moves (outlet_id, ingredient_id, kind, delta, unit_cost, reason, ref, created_by)
    values (p_outlet, p_ingredient, p_kind, round(p_delta, 2),
            coalesce(p_unit_cost, (select cost from public.pos_ingredients where id = p_ingredient), 0),
            left(coalesce(p_reason, ''), 80), coalesce(p_ref, ''), public.erp_me());
end;
$$;
revoke all on function public.erp_pos_ingredient_write(uuid, uuid, text, numeric, text, text, numeric) from public;

-- Bahan + stok outlet. Harga modal hanya untuk supervisor ke atas / produk / gudang / keuangan.
create or replace function public.erp_pos_ingredients(p_outlet uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
    v_cost boolean := public.erp_my_level() >= 3 or public.erp_has_role(array['produk', 'gudang', 'keuangan']);
begin
    if public.erp_me() is null then return '[]'::jsonb; end if;
    return coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', i.id, 'name', i.name, 'unit', i.unit, 'min_stock', i.min_stock, 'is_active', i.is_active,
            'cost', case when v_cost then i.cost end,
            'stock', coalesce(st.qty, 0)
        ) order by i.name)
        from public.pos_ingredients i
        left join public.pos_ingredient_stock st on st.ingredient_id = i.id and st.outlet_id = p_outlet
    ), '[]'::jsonb);
end;
$$;
revoke all on function public.erp_pos_ingredients(uuid) from public;
grant execute on function public.erp_pos_ingredients(uuid) to authenticated;

-- Gerak bahan manual: beli (harga rata-rata tertimbang + jurnal), buang (wajib alasan),
-- opname (HASIL HITUNG; selisih dicatat). Sama dengan demo-adapter-pos.js ingredientMove.
create or replace function public.erp_ingredient_move(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_me      uuid := public.erp_me();
    v_outlet  uuid := (p ->> 'outlet_id')::uuid;
    v_ing     public.pos_ingredients%rowtype;
    v_kind    text := p ->> 'kind';
    v_qty     numeric := round(coalesce(nullif(p ->> 'qty', '')::numeric, 0), 2);
    v_total   numeric := round(coalesce(nullif(p ->> 'total', '')::numeric, 0));
    v_current numeric;
    v_delta   numeric;
    v_value   numeric;
    v_credit  text;
    v_stockman boolean := public.erp_has_role(array['produk', 'gudang']) or public.erp_my_level() >= 3;
begin
    if v_me is null then raise exception 'Akses ditolak.'; end if;
    if not exists (select 1 from public.warehouses where id = v_outlet and kind = 'outlet') then
        raise exception 'Outlet tidak ditemukan.';
    end if;
    select * into v_ing from public.pos_ingredients where id::text = p ->> 'ingredient_id';
    if not found then raise exception 'Bahan tidak ditemukan.'; end if;
    select coalesce((select qty from public.pos_ingredient_stock where outlet_id = v_outlet and ingredient_id = v_ing.id), 0) into v_current;

    if v_kind = 'beli' then
        if not v_stockman then raise exception 'Akses ditolak: jabatanmu tidak boleh melakukan ini.'; end if;
        if v_qty <= 0 then raise exception 'Isi jumlah yang dibeli.'; end if;
        if v_total <= 0 then raise exception 'Isi total harga belanja.'; end if;
        update public.pos_ingredients
        set cost = round(((greatest(v_current, 0) * cost + v_total) / (greatest(v_current, 0) + v_qty))::numeric, 2)
        where id = v_ing.id;
        perform public.erp_pos_ingredient_write(v_outlet, v_ing.id, 'beli', v_qty, left(coalesce(p ->> 'reason', ''), 80), '', round(v_total / v_qty, 2));
        -- Permintaan restok untuk bahan ini otomatis selesai (tabel dibuat di bagian 12).
        if to_regclass('public.pos_restock_requests') is not null then
            execute 'update public.pos_restock_requests set status = ''selesai'', resolved_at = now(), resolved_by = $1, note = ''Otomatis: belanja bahan dicatat''
                     where outlet_id = $2 and ingredient_id = $3 and status = ''baru'''
            using v_me, v_outlet, v_ing.id;
        end if;
        v_credit := case p ->> 'pay' when 'utang' then '2-1000' when 'transfer' then '1-1100' else '1-1000' end;
        perform public.erp_journal_write((now() at time zone 'Asia/Jakarta')::date, 'Belanja bahan ' || v_ing.name, 'bahan', null,
            jsonb_build_array(jsonb_build_object('account_code', '1-1310', 'debit', v_total), jsonb_build_object('account_code', v_credit, 'credit', v_total)), v_me);
        return jsonb_build_object('delta', v_qty);

    elsif v_kind = 'buang' then
        if not public.erp_has_role(array['kasir', 'dapur', 'produk', 'gudang']) then raise exception 'Akses ditolak: jabatanmu tidak boleh melakukan ini.'; end if;
        if v_qty <= 0 then raise exception 'Isi jumlah yang dibuang.'; end if;
        if coalesce(p ->> 'reason', '') not in ('basi', 'tumpah', 'salah', 'sampel', 'lainnya') then raise exception 'Pilih alasan bahan dibuang.'; end if;
        perform public.erp_pos_ingredient_write(v_outlet, v_ing.id, 'buang', -v_qty, p ->> 'reason', '', null);
        v_value := round(v_qty * v_ing.cost);
        if v_value > 0 then
            perform public.erp_journal_write((now() at time zone 'Asia/Jakarta')::date, 'Bahan dibuang: ' || v_ing.name, 'bahan', null,
                jsonb_build_array(jsonb_build_object('account_code', '5-1100', 'debit', v_value), jsonb_build_object('account_code', '1-1310', 'credit', v_value)), v_me);
        end if;
        return jsonb_build_object('delta', -v_qty);

    elsif v_kind = 'opname' then
        if not v_stockman then raise exception 'Akses ditolak: jabatanmu tidak boleh melakukan ini.'; end if;
        if v_qty < 0 then raise exception 'Isi hasil hitung stok.'; end if;
        v_delta := round(v_qty - v_current, 2);
        if v_delta = 0 then return jsonb_build_object('delta', 0); end if;
        perform public.erp_pos_ingredient_write(v_outlet, v_ing.id, 'opname', v_delta, 'Hitung stok', '', null);
        v_value := round(abs(v_delta) * v_ing.cost);
        if v_value > 0 then
            perform public.erp_journal_write((now() at time zone 'Asia/Jakarta')::date, 'Selisih hitung stok ' || v_ing.name, 'bahan', null,
                case when v_delta < 0
                    then jsonb_build_array(jsonb_build_object('account_code', '5-1100', 'debit', v_value), jsonb_build_object('account_code', '1-1310', 'credit', v_value))
                    else jsonb_build_array(jsonb_build_object('account_code', '1-1310', 'debit', v_value), jsonb_build_object('account_code', '5-1100', 'credit', v_value))
                end, v_me);
        end if;
        return jsonb_build_object('delta', v_delta);
    end if;
    raise exception 'Jenis gerak bahan tidak valid.';
end;
$$;
revoke all on function public.erp_ingredient_move(jsonb) from public;
grant execute on function public.erp_ingredient_move(jsonb) to authenticated;

-- =========================================================
-- 11. TAHAP 6: RATING PELANGGAN & TRANSAKSI OFFLINE
--     Rating: 1 ketukan di layar pelanggan, tanpa data pribadi, 1 per struk.
-- =========================================================

alter table public.pos_sales add column if not exists offline   boolean not null default false;
alter table public.pos_sales add column if not exists synced_at timestamptz;

create table if not exists public.pos_sale_ratings (
    id         bigserial primary key,
    sale_id    uuid not null unique references public.pos_sales(id) on delete cascade,
    outlet_id  uuid references public.warehouses(id) on delete set null,
    cashier_id uuid references public.members(id) on delete set null,
    score      smallint not null check (score between 1 and 3),
    created_at timestamptz not null default now()
);
create index if not exists pos_sale_ratings_idx on public.pos_sale_ratings (created_at desc);

alter table public.pos_sale_ratings enable row level security;
drop policy if exists "erp baca rating" on public.pos_sale_ratings;
create policy "erp baca rating" on public.pos_sale_ratings for select
    using (public.erp_my_level() >= 3 or public.erp_has_role(array['keuangan']));

create or replace function public.erp_pos_rate_sale(p_sale uuid, p_score int)
returns void
language plpgsql security definer set search_path = public
as $$
begin
    if not public.erp_has_role(array['kasir']) then
        raise exception 'Akses ditolak: jabatanmu tidak boleh melakukan ini.';
    end if;
    if p_score not in (1, 2, 3) then raise exception 'Nilai tidak valid.'; end if;
    insert into public.pos_sale_ratings (sale_id, outlet_id, cashier_id, score)
    select id, outlet_id, cashier_id, p_score from public.pos_sales where id = p_sale
    on conflict (sale_id) do nothing;
end;
$$;
revoke all on function public.erp_pos_rate_sale(uuid, int) from public;
grant execute on function public.erp_pos_rate_sale(uuid, int) to authenticated;

-- =========================================================
-- 12. PERMINTAAN RESTOK DARI KASIR
--     Menu habis -> kasir/barista menekan "Minta restok" -> muncul di Resep & HPP.
--     Permintaan yang sama digabung (hitungan naik), selesai otomatis saat belanja dicatat.
-- =========================================================

create table if not exists public.pos_restock_requests (
    id              uuid primary key default gen_random_uuid(),
    outlet_id       uuid not null references public.warehouses(id) on delete cascade,
    product_id      text not null,
    name            text not null default '',
    ingredient_id   uuid references public.pos_ingredients(id) on delete set null,
    ingredient_name text not null default '',
    count           int not null default 1,
    status          text not null default 'baru' check (status in ('baru', 'selesai')),
    requested_by    uuid references public.members(id) on delete set null,
    created_at      timestamptz not null default now(),
    last_at         timestamptz not null default now(),
    resolved_at     timestamptz,
    resolved_by     uuid references public.members(id) on delete set null,
    note            text not null default ''
);
create unique index if not exists pos_restock_open_one on public.pos_restock_requests (outlet_id, product_id) where status = 'baru';

alter table public.pos_restock_requests enable row level security;
drop policy if exists "erp baca restok" on public.pos_restock_requests;
create policy "erp baca restok" on public.pos_restock_requests for select using (public.erp_me() is not null);

create or replace function public.erp_pos_request_restock(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_row public.pos_restock_requests%rowtype;
begin
    if not public.erp_has_role(array['kasir', 'dapur']) then
        raise exception 'Akses ditolak: jabatanmu tidak boleh melakukan ini.';
    end if;
    insert into public.pos_restock_requests (outlet_id, product_id, name, ingredient_id, ingredient_name, requested_by)
    values ((p ->> 'outlet_id')::uuid, p ->> 'product_id', left(coalesce(p ->> 'name', ''), 80),
            nullif(p ->> 'ingredient_id', '')::uuid, left(coalesce(p ->> 'ingredient_name', ''), 60), public.erp_me())
    on conflict (outlet_id, product_id) where status = 'baru'
    do update set count = public.pos_restock_requests.count + 1, last_at = now()
    returning * into v_row;
    return to_jsonb(v_row);
end;
$$;
revoke all on function public.erp_pos_request_restock(jsonb) from public;
grant execute on function public.erp_pos_request_restock(jsonb) to authenticated;

create or replace function public.erp_pos_resolve_restock(p_id uuid, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
    if not (public.erp_has_role(array['produk', 'gudang']) or public.erp_my_level() >= 3) then
        raise exception 'Akses ditolak: jabatanmu tidak boleh melakukan ini.';
    end if;
    update public.pos_restock_requests
    set status = 'selesai', resolved_at = now(), resolved_by = public.erp_me(), note = left(coalesce(p_note, ''), 80)
    where id = p_id;
end;
$$;
revoke all on function public.erp_pos_resolve_restock(uuid, text) from public;
grant execute on function public.erp_pos_resolve_restock(uuid, text) to authenticated;
