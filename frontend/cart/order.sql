-- ============================================================
-- cart/order.sql - Kantoong AI: tabel pesanan + fungsi aman
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run.
-- Aman diulang (idempotent): tidak menghapus data yang sudah ada.
--
-- PRINSIP KEAMANAN
--  1. Pengunjung TIDAK menulis langsung ke tabel. Mereka hanya memanggil
--     fungsi create_order(), yang memeriksa data dan MENGHITUNG ULANG harga
--     dari tabel products (harga kiriman browser tidak dipercaya).
--  2. Alamat & nomor HP pembeli hanya bisa dibaca oleh admin toko
--     (tabel memberships) dan oleh pembeli yang login atas pesanannya sendiri.
--
-- FORMAT DATA yang dikirim cart/order-api.js ke create_order(p jsonb):
-- {
--   "business_id": "master_template_001",
--   "prefix": "ORD",
--   "customer": { "name": "...", "phone": "08123456789", "email": "" },
--   "address":  { "line": "...", "district": "...", "city": "...", "province": "...", "postal_code": "..." },
--   "shipping": { "courier_code": "jne", "courier_name": "JNE", "service": "Reguler", "eta": "2-3 hari", "cost": 15000 },
--   "payment_method": "bca_va",
--   "note": "catatan untuk seluruh pesanan",
--   "service_fee": 1000,
--   "items": [ { "product_id": "123", "qty": 2, "note": "warna hitam" } ]
-- }
-- ============================================================

-- ---------- 0. Tabel admin toko (dipakai juga oleh dashboard nanti) ----------
create table if not exists public.memberships (
    user_id     uuid references auth.users on delete cascade,
    business_id text,
    role        text not null default 'admin' check (role in ('owner', 'admin', 'staff')),
    primary key (user_id, business_id)
);

alter table public.memberships enable row level security;

drop policy if exists "read own membership" on public.memberships;
create policy "read own membership" on public.memberships
    for select using (user_id = auth.uid());

-- Pembantu: apakah user yang login adalah staf toko ini? (security definer
-- agar tidak terkena rekursi RLS saat dipakai di policy tabel lain)
create or replace function public.is_business_staff(biz text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid() and m.business_id = biz
    );
$$;

-- ---------- 1. Tabel pesanan ----------
create table if not exists public.orders (
    id             uuid primary key default gen_random_uuid(),
    order_code     text not null unique,
    business_id    text not null default 'master_template_001',
    status         text not null default 'menunggu_pembayaran'
                   check (status in ('menunggu_pembayaran', 'dibayar', 'diproses', 'dikirim', 'selesai', 'dibatalkan')),

    customer_name  text not null,
    customer_phone text not null,
    customer_email text,

    address_line   text not null,
    district       text,
    city           text not null,
    province       text,
    postal_code    text,

    courier_code   text,
    courier_name   text,
    service_name   text,
    shipping_eta   text,
    shipping_cost  numeric(14, 0) not null default 0,

    payment_method text not null,
    note           text,

    items_total    numeric(14, 0) not null default 0,
    service_fee    numeric(14, 0) not null default 0,
    total          numeric(14, 0) not null default 0,

    user_id        uuid references auth.users on delete set null,  -- terisi jika pembeli login
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create table if not exists public.order_items (
    id           uuid primary key default gen_random_uuid(),
    order_id     uuid not null references public.orders on delete cascade,
    product_id   text not null,
    product_name text not null,
    unit_price   numeric(14, 0) not null,
    qty          int not null check (qty between 1 and 99),
    note         text,
    subtotal     numeric(14, 0) not null
);

create index if not exists orders_business_created_idx on public.orders (business_id, created_at desc);
create index if not exists orders_user_idx on public.orders (user_id);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- updated_at otomatis
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
    before update on public.orders
    for each row execute function public.touch_updated_at();

-- ---------- 2. RLS: tidak ada policy INSERT untuk umum (sengaja) ----------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "staff read orders" on public.orders;
create policy "staff read orders" on public.orders
    for select using (public.is_business_staff(business_id));

drop policy if exists "customer read own orders" on public.orders;
create policy "customer read own orders" on public.orders
    for select using (user_id is not null and user_id = auth.uid());

drop policy if exists "staff update orders" on public.orders;
create policy "staff update orders" on public.orders
    for update using (public.is_business_staff(business_id))
    with check (public.is_business_staff(business_id));

drop policy if exists "read items of visible orders" on public.order_items;
create policy "read items of visible orders" on public.order_items
    for select using (
        exists (
            select 1 from public.orders o
            where o.id = order_items.order_id
              and (public.is_business_staff(o.business_id) or (o.user_id is not null and o.user_id = auth.uid()))
        )
    );

-- ---------- 3. Fungsi pembuat pesanan (satu-satunya pintu masuk pengunjung) ----------
create or replace function public.create_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_biz      text := coalesce(nullif(trim(p ->> 'business_id'), ''), 'master_template_001');
    v_prefix   text := left(upper(regexp_replace(coalesce(p ->> 'prefix', 'ORD'), '[^A-Za-z0-9]', '', 'g')), 6);
    v_name     text := left(trim(coalesce(p #>> '{customer,name}', '')), 80);
    v_phone    text := regexp_replace(coalesce(p #>> '{customer,phone}', ''), '[^0-9]', '', 'g');
    v_email    text := nullif(left(trim(coalesce(p #>> '{customer,email}', '')), 120), '');
    v_line     text := left(trim(coalesce(p #>> '{address,line}', '')), 300);
    v_district text := nullif(left(trim(coalesce(p #>> '{address,district}', '')), 80), '');
    v_city     text := left(trim(coalesce(p #>> '{address,city}', '')), 80);
    v_province text := nullif(left(trim(coalesce(p #>> '{address,province}', '')), 80), '');
    v_postal   text := nullif(left(regexp_replace(coalesce(p #>> '{address,postal_code}', ''), '[^0-9]', '', 'g'), 10), '');
    v_courier_code text := nullif(left(trim(coalesce(p #>> '{shipping,courier_code}', '')), 30), '');
    v_courier_name text := nullif(left(trim(coalesce(p #>> '{shipping,courier_name}', '')), 60), '');
    v_service  text := nullif(left(trim(coalesce(p #>> '{shipping,service}', '')), 60), '');
    v_eta      text := nullif(left(trim(coalesce(p #>> '{shipping,eta}', '')), 40), '');
    v_ship     numeric := least(greatest(coalesce((p #>> '{shipping,cost}')::numeric, 0), 0), 5000000);
    v_fee      numeric := least(greatest(coalesce((p ->> 'service_fee')::numeric, 0), 0), 100000);
    v_pay      text := left(trim(coalesce(p ->> 'payment_method', '')), 40);
    v_note     text := nullif(left(trim(coalesce(p ->> 'note', '')), 500), '');

    v_id       uuid;
    v_code     text;
    v_item     jsonb;
    v_pid      text;
    v_qty      int;
    v_pname    text;
    v_pprice   numeric;
    v_items_total numeric := 0;
    v_count    int := 0;
    i          int;
begin
    -- Validasi data pembeli
    if length(v_name) < 2 then
        raise exception 'Nama penerima wajib diisi.';
    end if;
    if length(v_phone) < 9 or length(v_phone) > 15 then
        raise exception 'Nomor HP tidak valid.';
    end if;
    if length(v_line) < 10 then
        raise exception 'Alamat lengkap terlalu pendek.';
    end if;
    if length(v_city) < 2 then
        raise exception 'Kota/kabupaten wajib diisi.';
    end if;
    if length(v_pay) = 0 then
        raise exception 'Metode pembayaran belum dipilih.';
    end if;
    if jsonb_typeof(p -> 'items') is distinct from 'array'
       or jsonb_array_length(p -> 'items') < 1
       or jsonb_array_length(p -> 'items') > 50 then
        raise exception 'Keranjang kosong atau terlalu banyak barang.';
    end if;

    -- Buat pesanan dengan kode unik (coba ulang bila kebetulan bentrok)
    for i in 1..5 loop
        v_code := coalesce(nullif(v_prefix, ''), 'ORD') || '-'
                  || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-'
                  || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
        begin
            insert into public.orders (
                order_code, business_id, customer_name, customer_phone, customer_email,
                address_line, district, city, province, postal_code,
                courier_code, courier_name, service_name, shipping_eta, shipping_cost,
                payment_method, note, service_fee, user_id
            ) values (
                v_code, v_biz, v_name, v_phone, v_email,
                v_line, v_district, v_city, v_province, v_postal,
                v_courier_code, v_courier_name, v_service, v_eta, v_ship,
                v_pay, v_note, v_fee, auth.uid()
            ) returning id into v_id;
            exit;
        exception when unique_violation then
            v_id := null;
        end;
    end loop;

    if v_id is null then
        raise exception 'Gagal membuat kode pesanan, coba lagi.';
    end if;

    -- Isi barang: nama & harga DIAMBIL DARI TABEL products, bukan dari browser
    for v_item in select * from jsonb_array_elements(p -> 'items') loop
        v_pid := trim(coalesce(v_item ->> 'product_id', ''));
        v_qty := coalesce((v_item ->> 'qty')::int, 0);

        if v_qty < 1 or v_qty > 99 then
            raise exception 'Jumlah barang harus antara 1 dan 99.';
        end if;

        select pr.name::text, pr.price::numeric
          into v_pname, v_pprice
          from public.products pr
         where pr.id::text = v_pid
         limit 1;

        if v_pname is null then
            raise exception 'Produk tidak ditemukan (id: %). Mungkin sudah dihapus.', v_pid;
        end if;

        insert into public.order_items (order_id, product_id, product_name, unit_price, qty, note, subtotal)
        values (
            v_id, v_pid, v_pname, v_pprice, v_qty,
            nullif(left(trim(coalesce(v_item ->> 'note', '')), 300), ''),
            v_pprice * v_qty
        );

        v_items_total := v_items_total + v_pprice * v_qty;
        v_count := v_count + 1;
        v_pname := null;
    end loop;

    update public.orders
       set items_total = v_items_total,
           total = v_items_total + v_ship + v_fee
     where id = v_id;

    return jsonb_build_object(
        'order_code', v_code,
        'status', 'menunggu_pembayaran',
        'items_total', v_items_total,
        'shipping_cost', v_ship,
        'service_fee', v_fee,
        'total', v_items_total + v_ship + v_fee,
        'item_count', v_count
    );
end;
$$;

-- Hanya fungsi ini yang boleh dipanggil pengunjung
revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;

-- ============================================================
-- LANGKAH SETELAH MENJALANKAN FILE INI
--
-- A. Jadikan dirimu admin toko (agar bisa membaca pesanan):
--    1) Login ke webmu dengan Google (atau buat user di Authentication > Users)
--    2) Salin UUID user itu, lalu jalankan:
--       insert into public.memberships (user_id, business_id, role)
--       values ('UUID_USER_KAMU', 'master_template_001', 'owner');
--
-- B. Tes cepat (ganti PRODUCT_ID dengan id produk asli di tabel products):
--    select public.create_order('{
--      "business_id": "master_template_001",
--      "customer": {"name": "Tes Pembeli", "phone": "081234567890"},
--      "address":  {"line": "Jl. Contoh No. 1, RT 01/RW 02", "city": "Bandung"},
--      "shipping": {"courier_code": "jne", "courier_name": "JNE", "service": "Reguler", "eta": "2-3 hari", "cost": 15000},
--      "payment_method": "bca_va",
--      "service_fee": 1000,
--      "items": [{"product_id": "PRODUCT_ID", "qty": 2, "note": "tes"}]
--    }'::jsonb);
--    Hasilnya berisi order_code. Lihat pesanan di Table Editor > orders.
--
-- C. Pastikan pengunjung TIDAK bisa membaca pesanan: di SQL Editor pilih
--    role "anon" lalu jalankan  select * from public.orders;  -> harus kosong.
-- ============================================================