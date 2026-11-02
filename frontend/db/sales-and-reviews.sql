-- =========================================================
-- KANTOONG CORE — ANGKA TERJUAL OTOMATIS + ULASAN BINTANG
-- File: frontend/db/sales-and-reviews.sql
--
-- Jalankan SEKALI di Supabase > SQL Editor (setelah cart/order.sql
-- dan db/owner-and-pin.sql). Aman dijalankan ulang.
--
-- A. "xx terjual" bertambah OTOMATIS saat pesanan berstatus dibayar
--    (dibayar / diproses / dikirim / selesai), dan berkurang lagi
--    bila pesanan yang sudah dibayar dibatalkan.
-- B. Ulasan bintang 1–5 hanya dari pembeli asli: pesanan harus
--    berstatus "selesai" dan dicocokkan dengan kode pesanan + no. HP.
--    Rata-rata bintang & jumlah ulasan di kartu produk ikut otomatis.
-- =========================================================


-- ---------- A. ANGKA TERJUAL OTOMATIS ----------

alter table public.products
    add column if not exists sales_count integer not null default 0;

create or replace function public.order_is_paid(status text)
returns boolean
language sql
immutable
as $$
    select status in ('dibayar', 'diproses', 'dikirim', 'selesai');
$$;

create or replace function public.sync_sales_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_sign int := 0;
begin
    -- Baru dibayar: tambah. Dibatalkan setelah dibayar: kurangi.
    if public.order_is_paid(new.status)
       and (tg_op = 'INSERT' or not public.order_is_paid(old.status)) then
        v_sign := 1;
    elsif tg_op = 'UPDATE'
       and public.order_is_paid(old.status)
       and not public.order_is_paid(new.status) then
        v_sign := -1;
    end if;

    if v_sign <> 0 then
        update public.products p
           set sales_count = greatest(0, p.sales_count + v_sign * x.qty)
          from (
                select product_id, sum(qty)::int as qty
                  from public.order_items
                 where order_id = new.id
                 group by product_id
               ) x
         where p.id::text = x.product_id;
    end if;

    return new;
end;
$$;

drop trigger if exists orders_sync_sales_count on public.orders;
create trigger orders_sync_sales_count
    after insert or update of status on public.orders
    for each row execute function public.sync_sales_count();


-- ---------- B. ULASAN & RATING ----------

alter table public.products
    add column if not exists rating_avg numeric(2, 1) not null default 0;

alter table public.products
    add column if not exists review_count integer not null default 0;

create table if not exists public.product_reviews (
    id             uuid primary key default gen_random_uuid(),
    product_id     text not null,
    business_id    text not null,
    order_id       uuid not null references public.orders on delete cascade,
    rating         smallint not null check (rating between 1 and 5),
    comment        text check (comment is null or char_length(comment) <= 500),
    reviewer_label text not null,          -- disamarkan, contoh "R***a"
    created_at     timestamptz not null default now(),
    unique (order_id, product_id)          -- 1 ulasan per produk per pesanan
);

create index if not exists product_reviews_product_idx
    on public.product_reviews (product_id, created_at desc);

alter table public.product_reviews enable row level security;

-- Ulasan boleh dibaca semua orang (nama sudah disamarkan).
drop policy if exists "public read reviews" on public.product_reviews;
create policy "public read reviews" on public.product_reviews
    for select using (true);

-- Tidak ada policy INSERT/UPDATE: ulasan hanya lewat fungsi submit_review.

-- Rata-rata bintang & jumlah ulasan diperbarui otomatis.
create or replace function public.sync_product_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pid text := coalesce(new.product_id, old.product_id);
begin
    update public.products p
       set rating_avg = coalesce(s.avg_rating, 0),
           review_count = coalesce(s.total, 0)
      from (
            select round(avg(rating)::numeric, 1) as avg_rating, count(*)::int as total
              from public.product_reviews
             where product_id = v_pid
           ) s
     where p.id::text = v_pid;

    return null;
end;
$$;

drop trigger if exists product_reviews_sync_rating on public.product_reviews;
create trigger product_reviews_sync_rating
    after insert or update or delete on public.product_reviews
    for each row execute function public.sync_product_rating();

-- Pintu masuk ulasan: pembeli membuktikan pesanannya dengan kode + no. HP.
create or replace function public.submit_review(
    p_order_code text,
    p_phone      text,
    p_product_id text,
    p_rating     int,
    p_comment    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_order public.orders%rowtype;
    v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
    v_name  text;
    v_label text;
begin
    if p_rating is null or p_rating < 1 or p_rating > 5 then
        raise exception 'Bintang harus 1 sampai 5.';
    end if;

    select * into v_order
      from public.orders
     where order_code = upper(trim(coalesce(p_order_code, '')))
       and customer_phone = v_phone;

    if not found then
        raise exception 'Pesanan tidak ditemukan. Cek kode pesanan dan nomor HP.';
    end if;

    if v_order.status <> 'selesai' then
        raise exception 'Ulasan bisa diberikan setelah pesanan selesai.';
    end if;

    if not exists (
        select 1 from public.order_items
         where order_id = v_order.id and product_id = p_product_id
    ) then
        raise exception 'Produk ini tidak ada di pesanan tersebut.';
    end if;

    -- Nama disamarkan: "Rina" -> "R***a".
    v_name := trim(v_order.customer_name);
    v_label := case
        when length(v_name) <= 2 then left(v_name, 1) || '***'
        else left(v_name, 1) || '***' || right(v_name, 1)
    end;

    insert into public.product_reviews
        (product_id, business_id, order_id, rating, comment, reviewer_label)
    values
        (p_product_id, v_order.business_id, v_order.id, p_rating,
         nullif(left(trim(coalesce(p_comment, '')), 500), ''), v_label)
    on conflict (order_id, product_id) do update
        set rating = excluded.rating,
            comment = excluded.comment,
            created_at = now();

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_review(text, text, text, int, text) from public;
grant execute on function public.submit_review(text, text, text, int, text) to anon, authenticated;

-- Muat ulang cache skema agar kolom & fungsi baru langsung dikenali.
notify pgrst, 'reload schema';
